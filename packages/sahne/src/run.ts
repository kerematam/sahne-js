import { Effect, FiberSet, FileSystem, Scope } from 'effect';
import type { Browser, HTTPRequest, Page, Target } from 'puppeteer';
import Request from './Request.js';
import {
	HookError,
	NavigationError,
	PageSetupError,
	type InterceptionError,
	type RequestActionError,
	type RunnerError
} from './errors.js';
import { InterceptionLive, ProxyTransport, PuppeteerLauncher, RunnerLive } from './services.js';
import type {
	InterceptorConfig,
	MaybePromise,
	ProcessedInterceptorConfig,
	SahneConfig
} from './types.js';
import {
	handleOnError,
	handleRequest,
	handleRequestConfig,
	handleResponse,
	logInterceptionError,
	makeHandleProxy,
	type RuleOutcome
} from './utils/index.js';

const resolved: RuleOutcome = { _tag: 'Resolved' };
const nextRule: RuleOutcome = { _tag: 'NextRule' };

const preprocessConfigs = (
	configs?: InterceptorConfig | ReadonlyArray<InterceptorConfig>
): ReadonlyArray<ProcessedInterceptorConfig> => {
	if (configs === undefined) return [];
	const allConfigs = Array.isArray(configs) ? configs : [configs];
	return allConfigs.map((config) => ({
		...config,
		handlers: { handleProxyUrl: makeHandleProxy({ proxy: config.proxy }) }
	}));
};

const fallbackOutcome = (request: Request): RuleOutcome => {
	if (request.isResolutionHandled()) return resolved;
	return nextRule;
};

const recoverRuleFailure = ({
	request,
	config,
	error
}: {
	readonly request: Request;
	readonly config: ProcessedInterceptorConfig;
	readonly error: InterceptionError;
}): Effect.Effect<RuleOutcome, never> =>
	Effect.gen(function* () {
		yield* logInterceptionError(error);
		if (request.isResolutionHandled()) return resolved;

		const recoveryResponse = yield* handleOnError({
			request,
			error,
			onError: config.onError
		}).pipe(
			Effect.catch((onErrorFailure) =>
				logInterceptionError(onErrorFailure).pipe(Effect.as(undefined))
			)
		);

		if (request.isResolutionHandled()) return resolved;
		if (request.isNextCalled) return nextRule;
		if (recoveryResponse === undefined) return nextRule;

		return yield* handleResponse({
			request,
			response: recoveryResponse,
			config
		}).pipe(
			Effect.catch((responseFailure) =>
				logInterceptionError(responseFailure).pipe(Effect.as(fallbackOutcome(request)))
			)
		);
	});

export const handleInterceptionEffect = (
	interceptedRequest: HTTPRequest,
	config: ProcessedInterceptorConfig
): Effect.Effect<RuleOutcome, never, FileSystem.FileSystem | ProxyTransport> => {
	const request = new Request(interceptedRequest);

	return Effect.gen(function* () {
		const requestConfigOutcome = yield* handleRequestConfig({
			request,
			match: config.match,
			ignore: config.ignore,
			onRequest: config.onRequest,
			next: config.next,
			abort: config.abort
		});
		if (requestConfigOutcome._tag !== 'Matched') return requestConfigOutcome;

		const { response, responseFromProxyRequest } = yield* handleRequest({ request, config });
		return yield* handleResponse({
			request,
			response,
			responseFromProxyRequest,
			config
		});
	}).pipe(Effect.catch((error) => recoverRuleFailure({ request, config, error })));
};

export const handleInterception = (
	interceptedRequest: HTTPRequest,
	config: ProcessedInterceptorConfig
): Promise<RuleOutcome> =>
	Effect.runPromise(
		handleInterceptionEffect(interceptedRequest, config).pipe(Effect.provide(InterceptionLive))
	);

export const handleRequestEffect = (
	interceptedRequest: HTTPRequest,
	configs: ReadonlyArray<ProcessedInterceptorConfig>
): Effect.Effect<void, RequestActionError, FileSystem.FileSystem | ProxyTransport> =>
	Effect.gen(function* () {
		for (const config of configs) {
			if (interceptedRequest.isInterceptResolutionHandled()) return;
			yield* handleInterceptionEffect(interceptedRequest, config);
		}

		if (!interceptedRequest.isInterceptResolutionHandled()) {
			yield* new Request(interceptedRequest).continueEffect;
		}
	});

export class Interceptor {
	readonly #configs: ReadonlyArray<ProcessedInterceptorConfig>;

	constructor(configs: InterceptorConfig | InterceptorConfig[]) {
		this.#configs = preprocessConfigs(configs);
	}

	handleRequest = (interceptedRequest: HTTPRequest): Promise<void> =>
		Effect.runPromise(
			handleRequestEffect(interceptedRequest, this.#configs).pipe(Effect.provide(InterceptionLive))
		);
}

const invokeRunnerHook = <A>(
	name: string,
	evaluate: () => MaybePromise<A>
): Effect.Effect<A, HookError> =>
	Effect.tryPromise({
		try: async () => await evaluate(),
		catch: (cause) =>
			new HookError({
				hook: name,
				cause,
				message: `Failed while executing ${name}`
			})
	});

const pageOperation = <A>(
	operation: string,
	evaluate: () => Promise<A>
): Effect.Effect<A, PageSetupError> =>
	Effect.tryPromise({
		try: evaluate,
		catch: (cause) =>
			new PageSetupError({
				operation,
				cause,
				message: `Failed during Puppeteer page operation ${operation}`
			})
	});

const closeBrowser = (browser: Browser): Effect.Effect<void> =>
	Effect.suspend(() => {
		if (!browser.connected) return Effect.void;
		return Effect.tryPromise(() => browser.close()).pipe(
			Effect.catch((cause) => Effect.logWarning(`Failed to close Puppeteer: ${String(cause)}`))
		);
	});

const awaitBrowserDisconnected = (browser: Browser): Effect.Effect<void> =>
	Effect.suspend(() => {
		if (!browser.connected) return Effect.void;
		return Effect.callback<void>((resume) => {
			const onDisconnected = () => resume(Effect.void);
			browser.once('disconnected', onDisconnected);
			return Effect.sync(() => browser.off('disconnected', onDisconnected));
		});
	});

export const runEffect = ({
	initialUrl,
	puppeteerOptions,
	interceptor: interceptorConfig,
	callback = {}
}: SahneConfig): Effect.Effect<
	void,
	RunnerError,
	Scope.Scope | FileSystem.FileSystem | ProxyTransport | PuppeteerLauncher
> =>
	Effect.gen(function* () {
		yield* invokeRunnerHook('beforeLaunch', () => callback.beforeLaunch?.());

		const launcher = yield* PuppeteerLauncher;
		const browser = yield* Effect.acquireRelease(
			launcher.launch({
				defaultViewport: null,
				headless: false,
				...(puppeteerOptions?.launch ?? {})
			}),
			closeBrowser
		);

		yield* invokeRunnerHook('afterLaunch', () => callback.afterLaunch?.(browser));

		const configs = preprocessConfigs(interceptorConfig);
		const fibers = yield* FiberSet.make<void, RequestActionError | PageSetupError>();
		const runFork = yield* FiberSet.runtime(fibers)<
			Scope.Scope | FileSystem.FileSystem | ProxyTransport
		>();
		const configuredPages = new WeakSet<Page>();

		const setupInterception = (page: Page) =>
			Effect.gen(function* () {
				if (configuredPages.has(page)) return;
				configuredPages.add(page);

				yield* pageOperation('setViewport', () => page.setViewport({ width: 0, height: 0 }));
				if (configs.length === 0) return;
				yield* pageOperation('setRequestInterception', () => page.setRequestInterception(true));
				const onRequest = (request: HTTPRequest): void => {
					runFork(handleRequestEffect(request, configs));
				};
				page.on('request', onRequest);
				yield* Effect.addFinalizer(() => Effect.sync(() => page.off('request', onRequest)));
			});

		const setupTarget = (target: Target) =>
			Effect.gen(function* () {
				const page = yield* pageOperation('target.page', () => target.page());
				if (page !== null) yield* setupInterception(page);
			});

		const onTargetCreated = (target: Target): void => {
			runFork(setupTarget(target));
		};
		browser.on('targetcreated', onTargetCreated);
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => browser.off('targetcreated', onTargetCreated))
		);

		const pages = yield* pageOperation('browser.pages', () => browser.pages());
		const initialPage = pages[0];
		if (initialPage === undefined) {
			return yield* new PageSetupError({
				operation: 'browser.pages',
				cause: new Error('Puppeteer returned no initial page'),
				message: 'Puppeteer returned no initial page'
			});
		}
		yield* setupInterception(initialPage);

		yield* invokeRunnerHook('beforeGoto', () => callback.beforeGoto?.(browser, initialPage));
		yield* Effect.tryPromise({
			try: () => initialPage.goto(initialUrl, puppeteerOptions?.goto),
			catch: (cause) =>
				new NavigationError({
					url: initialUrl,
					cause,
					message: `Failed to navigate to ${initialUrl}`
				})
		});
		yield* invokeRunnerHook('afterGoto', () => callback.afterGoto?.(browser, initialPage));

		yield* Effect.raceFirst(awaitBrowserDisconnected(browser), FiberSet.join(fibers));
	});

export const run = (config: SahneConfig): Promise<void> =>
	Effect.runPromise(runEffect(config).pipe(Effect.provide(RunnerLive), Effect.scoped));
