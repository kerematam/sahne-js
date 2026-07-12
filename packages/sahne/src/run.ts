import { Deferred, Effect, FiberSet, FileSystem, Scope } from 'effect';
import type { Browser, HTTPRequest, Page, Target } from 'puppeteer';
import Request from './Request.js';
import {
	resolveBrowserPolicy,
	supportsRemoteDebuggingMode,
	type BrowserRuntimeEnvironment
} from './browser.js';
import {
	BrowserConnectError,
	BrowserLaunchError,
	ConfigValidationError,
	HookError,
	NavigationError,
	PageSetupError,
	type InterceptionError,
	type RequestActionError,
	type RunnerError
} from './errors.js';
import {
	InterceptionLive,
	ProxyTransport,
	PuppeteerConnectTimeoutError,
	PuppeteerLauncher,
	RunnerLive
} from './services.js';
import type {
	InterceptorConfig,
	MaybePromise,
	ProcessedInterceptorConfig,
	SahneBrowserMode,
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
const titleIndicatorPrefix = '🟢 Sahne — ';
const titleIndicatorStateKey = '__sahneTitleIndicator__';
const dangerousAllTabsWarning =
	'DANGER: browser.dangerouslyEnableForAllTabs is enabled. All tabs in the connected browser, including authenticated and sensitive pages, now pass through Sahne request interception.';

export type RunEffectOptions = {
	readonly browserMode?: SahneBrowserMode;
	readonly environment?: BrowserRuntimeEnvironment;
};

const installTitleIndicatorInDocument = (prefix: string, stateKey: string): void => {
	type IndicatorState = {
		readonly bootstrapObserver: MutationObserver;
		readonly headObserver: MutationObserver;
		readonly rootObserver: MutationObserver;
		readonly onReadyStateChange: () => void;
	};

	const stateHost = globalThis as typeof globalThis & Record<string, IndicatorState | undefined>;
	const previous = stateHost[stateKey];
	previous?.bootstrapObserver.disconnect();
	previous?.headObserver.disconnect();
	previous?.rootObserver.disconnect();
	if (previous !== undefined) {
		document.removeEventListener('readystatechange', previous.onReadyStateChange);
	}

	const markTitle = (): void => {
		if (document.querySelector('title') === null && document.readyState === 'loading') return;
		if (!document.title.startsWith(prefix)) document.title = `${prefix}${document.title}`;
	};

	let observedHead: HTMLHeadElement | null = null;
	let isObservingRoot = false;
	const headObserver = new MutationObserver(markTitle);
	const rootObserver = new MutationObserver(syncObservers);
	const bootstrapObserver = new MutationObserver(syncObservers);

	function syncObservers(): void {
		const root = document.documentElement;
		if (!isObservingRoot && root !== null) {
			rootObserver.observe(root, { childList: true });
			isObservingRoot = true;
		}

		const head = document.head;
		if (head === null) return;
		bootstrapObserver.disconnect();
		if (head !== observedHead) {
			headObserver.disconnect();
			headObserver.observe(head, { childList: true, subtree: true, characterData: true });
			observedHead = head;
		}
		markTitle();
	}

	bootstrapObserver.observe(document, { childList: true, subtree: true });
	const onReadyStateChange = (): void => syncObservers();
	document.addEventListener('readystatechange', onReadyStateChange);
	stateHost[stateKey] = {
		bootstrapObserver,
		headObserver,
		rootObserver,
		onReadyStateChange
	};
	syncObservers();
};

const removeTitleIndicatorFromDocument = (
	prefix: string,
	stateKey: string,
	restoreTitle: boolean
): void => {
	type IndicatorState = {
		readonly bootstrapObserver: MutationObserver;
		readonly headObserver: MutationObserver;
		readonly rootObserver: MutationObserver;
		readonly onReadyStateChange: () => void;
	};

	const stateHost = globalThis as typeof globalThis & Record<string, IndicatorState | undefined>;
	const state = stateHost[stateKey];
	state?.bootstrapObserver.disconnect();
	state?.headObserver.disconnect();
	state?.rootObserver.disconnect();
	if (state !== undefined) {
		document.removeEventListener('readystatechange', state.onReadyStateChange);
	}
	delete stateHost[stateKey];
	if (restoreTitle && document.title.startsWith(prefix)) {
		document.title = document.title.slice(prefix.length);
	}
};

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

const disconnectBrowser = (browser: Browser): Effect.Effect<void> =>
	Effect.suspend(() => {
		if (!browser.connected) return Effect.void;
		return Effect.tryPromise(() => browser.disconnect()).pipe(
			Effect.catch((cause) => Effect.logWarning(`Failed to disconnect Puppeteer: ${String(cause)}`))
		);
	});

const closeManagedPage = (page: Page): Effect.Effect<void> =>
	Effect.suspend(() => {
		if (page.isClosed()) return Effect.void;
		return Effect.tryPromise(() => page.close()).pipe(
			Effect.catch((cause) =>
				Effect.logWarning(`Failed to close Sahne's managed page: ${String(cause)}`)
			)
		);
	});

const disablePageInterception = (
	page: Page,
	onRequest: (request: HTTPRequest) => void
): Effect.Effect<void> =>
	Effect.sync(() => page.off('request', onRequest)).pipe(
		Effect.andThen(
			Effect.suspend(() => {
				if (page.isClosed()) return Effect.void;
				return Effect.tryPromise(() => page.setRequestInterception(false)).pipe(
					Effect.catch((cause) =>
						Effect.logWarning(
							`Failed to disable Sahne request interception on a page: ${String(cause)}`
						)
					)
				);
			})
		)
	);

const releaseTitleIndicator = ({
	page,
	identifier,
	restoreTitle
}: {
	readonly page: Page;
	readonly identifier: string | undefined;
	readonly restoreTitle: boolean;
}): Effect.Effect<void> =>
	Effect.suspend(() => {
		if (page.isClosed() || !restoreTitle) return Effect.void;
		return Effect.tryPromise(async () => {
			const failures: unknown[] = [];
			try {
				const removeScript = page.removeScriptToEvaluateOnNewDocument;
				if (identifier === undefined || typeof removeScript !== 'function') {
					throw new Error(
						'This Puppeteer version cannot remove scripts installed with evaluateOnNewDocument'
					);
				}
				await removeScript.call(page, identifier);
			} catch (cause) {
				failures.push(cause);
			}

			try {
				await page.evaluate(
					removeTitleIndicatorFromDocument,
					titleIndicatorPrefix,
					titleIndicatorStateKey,
					restoreTitle
				);
			} catch (cause) {
				failures.push(cause);
			}

			return failures;
		}).pipe(
			Effect.flatMap((failures) =>
				failures.length === 0
					? Effect.void
					: Effect.logWarning(
							`Failed to fully remove Sahne's managed-page title marker: ${failures.map(String).join('; ')}`
						)
			),
			Effect.catch((cause) =>
				Effect.logWarning(`Failed to remove Sahne's managed-page title marker: ${String(cause)}`)
			)
		);
	});

type BrowserResource = {
	readonly browser: Browser;
	readonly ownership: 'launched' | 'connected';
};

const releaseBrowser = ({ browser, ownership }: BrowserResource): Effect.Effect<void> =>
	ownership === 'launched' ? closeBrowser(browser) : disconnectBrowser(browser);

const remoteDebuggingConnectionError = (
	channel: string,
	cause: BrowserConnectError
): BrowserConnectError => {
	const summary =
		cause.cause instanceof PuppeteerConnectTimeoutError
			? `Sahne timed out after ${cause.cause.timeout}ms while waiting for Chrome remote-debugging approval (${channel}).`
			: `Sahne could not connect through Chrome remote debugging (${channel}).`;

	return new BrowserConnectError({
		cause: cause.cause,
		exposeCause: false,
		message: `${summary}

1. Start the selected Chrome channel.
2. Open chrome://inspect/#remote-debugging.
3. Enable remote debugging.
4. Run Sahne again and approve Chrome's prompt.

To launch an isolated browser instead:
  sahne --browser=launch`
	});
};

const awaitBrowserDisconnected = (browser: Browser): Effect.Effect<void> =>
	Effect.suspend(() => {
		if (!browser.connected) return Effect.void;
		return Effect.callback<void>((resume) => {
			const onDisconnected = () => resume(Effect.void);
			browser.once('disconnected', onDisconnected);
			return Effect.sync(() => browser.off('disconnected', onDisconnected));
		});
	});

const awaitPageClosed = (page: Page): Effect.Effect<void> =>
	Effect.suspend(() => {
		if (page.isClosed()) return Effect.void;
		return Effect.callback<void>((resume) => {
			const onClose = () => resume(Effect.void);
			page.once('close', onClose);
			return Effect.sync(() => page.off('close', onClose));
		});
	});

export const runEffect = (
	{
		initialUrl,
		puppeteerOptions,
		interceptor: interceptorConfig,
		callback = {},
		browser: browserOptions = {}
	}: SahneConfig,
	options: RunEffectOptions = {}
): Effect.Effect<
	void,
	RunnerError | ConfigValidationError,
	Scope.Scope | FileSystem.FileSystem | ProxyTransport | PuppeteerLauncher
> =>
	Effect.gen(function* () {
		const launcher = yield* PuppeteerLauncher;
		let browserPolicy = yield* resolveBrowserPolicy(
			{
				initialUrl,
				puppeteerOptions,
				interceptor: interceptorConfig,
				callback,
				browser: browserOptions
			},
			{ modeOverride: options.browserMode, environment: options.environment }
		);

		if (
			browserPolicy._tag === 'RemoteDebugging' &&
			!supportsRemoteDebuggingMode(launcher.version)
		) {
			if (browserPolicy.requestedMode === 'remote-debugging') {
				return yield* new ConfigValidationError({
					message: `Remote-debugging mode requires Puppeteer >=24.32.0; found ${launcher.version}`
				});
			}
			yield* Effect.logWarning(
				`Puppeteer ${launcher.version} does not support Chrome remote-debugging discovery; browser.mode "auto" is launching an isolated browser instead.`
			);
			browserPolicy = { _tag: 'Launch', requestedMode: 'auto' };
		}

		yield* invokeRunnerHook('beforeLaunch', () => callback.beforeLaunch?.());

		if (browserPolicy._tag === 'RemoteDebugging') {
			yield* Effect.logInfo(
				`Requesting access to Chrome remote debugging (${browserPolicy.channel})...`
			);
		}
		const remoteDebuggingTimeout = browserOptions.remoteDebuggingTimeout ?? 60_000;

		const launchBrowser = () =>
			launcher
				.launch({
					defaultViewport: null,
					headless: false,
					...(puppeteerOptions?.launch ?? {})
				})
				.pipe(Effect.map((browser): BrowserResource => ({ browser, ownership: 'launched' })));
		const acquireBrowser: Effect.Effect<BrowserResource, BrowserLaunchError | BrowserConnectError> =
			browserPolicy._tag === 'RawConnect'
				? launcher
						.connect(puppeteerOptions?.connect ?? {})
						.pipe(Effect.map((browser): BrowserResource => ({ browser, ownership: 'connected' })))
				: browserPolicy._tag === 'RemoteDebugging'
					? launcher.connect({ channel: browserPolicy.channel }, remoteDebuggingTimeout).pipe(
							Effect.mapError((cause) =>
								remoteDebuggingConnectionError(browserPolicy.channel, cause)
							),
							Effect.map((browser): BrowserResource => ({ browser, ownership: 'connected' }))
						)
					: launchBrowser();
		const browserResource = yield* Effect.acquireRelease(acquireBrowser, releaseBrowser);
		const { browser, ownership } = browserResource;

		yield* invokeRunnerHook('afterLaunch', () => callback.afterLaunch?.(browser));

		const configs = preprocessConfigs(interceptorConfig);
		const fibers = yield* FiberSet.make<void, RequestActionError | PageSetupError>();
		const runFork = yield* FiberSet.runtime(fibers)<
			Scope.Scope | FileSystem.FileSystem | ProxyTransport
		>();
		const pageReadiness = new WeakMap<Page, Deferred.Deferred<void, PageSetupError>>();
		const prepareInterception = (page: Page): Effect.Effect<void, PageSetupError, Scope.Scope> =>
			Effect.suspend(() => {
				const existing = pageReadiness.get(page);
				if (existing !== undefined) return Deferred.await(existing);

				const ready = Deferred.makeUnsafe<void, PageSetupError>();
				pageReadiness.set(page, ready);
				const preparation = Effect.gen(function* () {
					if (configs.length === 0) return;
					yield* pageOperation('setRequestInterception', () => page.setRequestInterception(true));
					const onRequest = (request: HTTPRequest): void => {
						runFork(handleRequestEffect(request, configs));
					};
					page.on('request', onRequest);
					yield* Effect.addFinalizer(() => disablePageInterception(page, onRequest));
				});

				return preparation.pipe(Effect.onExit((exit) => Deferred.done(ready, exit)));
			});

		const setSahneViewport = (page: Page): Effect.Effect<void, PageSetupError> =>
			pageOperation('setViewport', () => page.setViewport({ width: 0, height: 0 }));

		const setupTarget = (target: Target, setViewport: boolean) =>
			Effect.gen(function* () {
				const page = yield* pageOperation('target.page', () => target.page());
				if (page === null) return;
				if (setViewport) yield* setSahneViewport(page);
				yield* prepareInterception(page);
			});

		const enableFuturePageInterception = (
			setViewport: boolean
		): Effect.Effect<void, never, Scope.Scope> =>
			Effect.gen(function* () {
				const onTargetCreated = (target: Target): void => {
					runFork(setupTarget(target, setViewport));
				};
				browser.on('targetcreated', onTargetCreated);
				yield* Effect.addFinalizer(() =>
					Effect.sync(() => browser.off('targetcreated', onTargetCreated))
				);
			});

		let initialPage: Page;
		if (ownership === 'launched') {
			yield* enableFuturePageInterception(true);
			const pages = yield* pageOperation('browser.pages', () => browser.pages());
			const firstPage = pages[0];
			if (firstPage === undefined) {
				return yield* new PageSetupError({
					operation: 'browser.pages',
					cause: new Error('Puppeteer returned no initial page'),
					message: 'Puppeteer returned no initial page'
				});
			}
			initialPage = firstPage;
			yield* setSahneViewport(initialPage);
			yield* prepareInterception(initialPage);
		} else {
			if (browserOptions.dangerouslyEnableForAllTabs === true) {
				yield* Effect.logWarning(dangerousAllTabsWarning);
				yield* enableFuturePageInterception(false);
				const existingPages = yield* pageOperation('browser.pages', () => browser.pages());
				for (const page of existingPages) yield* prepareInterception(page);
			}

			const closePageOnExit = browserOptions.closeManagedPageOnExit !== false;
			initialPage = yield* Effect.acquireRelease(
				pageOperation('browser.newPage', () => browser.newPage()),
				(page) => (closePageOnExit ? closeManagedPage(page) : Effect.void)
			);
			yield* setSahneViewport(initialPage);
			yield* prepareInterception(initialPage);

			if ((browserOptions.indicator ?? 'title') === 'title') {
				const evaluation = yield* Effect.acquireRelease(
					pageOperation('evaluateOnNewDocument', () =>
						initialPage.evaluateOnNewDocument(
							installTitleIndicatorInDocument,
							titleIndicatorPrefix,
							titleIndicatorStateKey
						)
					),
					(evaluation) =>
						releaseTitleIndicator({
							page: initialPage,
							identifier: evaluation?.identifier,
							restoreTitle: !closePageOnExit
						})
				);
				void evaluation;
				yield* pageOperation('evaluate title indicator', () =>
					initialPage.evaluate(
						installTitleIndicatorInDocument,
						titleIndicatorPrefix,
						titleIndicatorStateKey
					)
				);
			}
		}

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
		if (ownership === 'connected') {
			yield* pageOperation('bringToFront', () => initialPage.bringToFront());
			const title = yield* pageOperation('title', () => initialPage.title());
			yield* Effect.logInfo(`Sahne managed page ready: ${initialPage.url()} — ${title}`);
		}
		yield* invokeRunnerHook('afterGoto', () => callback.afterGoto?.(browser, initialPage));

		const awaitBrowserEnd =
			ownership === 'connected'
				? Effect.raceFirst(awaitBrowserDisconnected(browser), awaitPageClosed(initialPage))
				: awaitBrowserDisconnected(browser);
		yield* Effect.raceFirst(awaitBrowserEnd, FiberSet.join(fibers));
	});

export const run = (config: SahneConfig): Promise<void> =>
	Effect.runPromise(runEffect(config).pipe(Effect.provide(RunnerLive), Effect.scoped));
