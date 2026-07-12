import * as NodeFileSystem from '@effect/platform-node-shared/NodeFileSystem';
import { assert, describe, it } from '@effect/vitest';
import { Effect, Fiber, Layer } from 'effect';
import type { HTTPRequest, ResponseForRequest } from 'puppeteer';
import { validateConfig } from '../src/config.js';
import { ProxyRequestError } from '../src/errors.js';
import { Interceptor, handleRequestEffect } from '../src/run.js';
import { ProxyTransport } from '../src/services.js';
import type { InterceptorConfig, ProcessedInterceptorConfig } from '../src/types.js';
import { makeHandleProxy } from '../src/utils/index.js';

class FakeRequest {
	resolution: 'abort' | 'continue' | 'respond' | undefined;
	response: ResponseForRequest | undefined;

	constructor(
		readonly requestUrl = 'https://example.test/api/data',
		readonly requestMethod = 'GET'
	) {}

	abort = async (): Promise<void> => {
		this.resolution = 'abort';
	};

	continue = async (): Promise<void> => {
		this.resolution = 'continue';
	};

	respond = async (response: ResponseForRequest): Promise<void> => {
		this.response = response;
		this.resolution = 'respond';
	};

	isInterceptResolutionHandled = (): boolean => this.resolution !== undefined;
	url = (): string => this.requestUrl;
	method = (): string => this.requestMethod;
	headers = (): Record<string, string> => ({});
	postData = (): string | undefined => undefined;

	asHttpRequest = (): HTTPRequest => this as unknown as HTTPRequest;
}

const processed = (config: InterceptorConfig): ProcessedInterceptorConfig => ({
	...config,
	handlers: { handleProxyUrl: makeHandleProxy({ proxy: config.proxy }) }
});

const proxyLayer = (
	execute: (typeof ProxyTransport.Service)['execute']
): Layer.Layer<ProxyTransport> => Layer.succeed(ProxyTransport)({ execute });

describe('Effect interception pipeline', () => {
	it.effect('evaluates rules sequentially and proxies after next', () => {
		const request = new FakeRequest();
		const configs = [
			processed({ match: '**/api/**', next: '**/api/**' }),
			processed({ match: '**/api/**', proxy: 'https://proxy.test' })
		];
		const transport = proxyLayer(() =>
			Effect.succeed(
				new Response(JSON.stringify({ ok: true }), {
					status: 201,
					headers: { 'content-type': 'application/json' }
				})
			)
		);

		return handleRequestEffect(request.asHttpRequest(), configs).pipe(
			Effect.provide(Layer.mergeAll(NodeFileSystem.layer, transport)),
			Effect.andThen(
				Effect.sync(() => {
					assert.strictEqual(request.resolution, 'respond');
					assert.strictEqual(request.response?.status, 201);
				})
			)
		);
	});

	it.effect('sends a response returned by onError', () => {
		const request = new FakeRequest();
		const configs = [
			processed({
				match: '**/api/**',
				proxy: 'https://proxy.test',
				onError: () => ({ status: 503, body: 'fallback', headers: {}, contentType: 'text/plain' })
			})
		];
		const transport = proxyLayer((requestUrl, proxyUrl) =>
			Effect.fail(
				new ProxyRequestError({
					requestUrl,
					proxyUrl,
					cause: new Error('offline'),
					message: 'offline'
				})
			)
		);

		return handleRequestEffect(request.asHttpRequest(), configs).pipe(
			Effect.provide(Layer.mergeAll(NodeFileSystem.layer, transport)),
			Effect.andThen(
				Effect.sync(() => {
					assert.strictEqual(request.resolution, 'respond');
					assert.strictEqual(request.response?.status, 503);
				})
			)
		);
	});

	it.effect('continues unmatched requests exactly once', () => {
		const request = new FakeRequest();
		return handleRequestEffect(request.asHttpRequest(), [processed({ match: '**/other/**' })]).pipe(
			Effect.provide(
				Layer.mergeAll(
					NodeFileSystem.layer,
					proxyLayer(() => Effect.die('proxy should not run'))
				)
			),
			Effect.andThen(Effect.sync(() => assert.strictEqual(request.resolution, 'continue')))
		);
	});
});

describe('public compatibility', () => {
	it('keeps Interceptor.handleRequest Promise-based', async () => {
		const request = new FakeRequest();
		const interceptor = new Interceptor({ match: '**/other/**' });
		const result = interceptor.handleRequest(request.asHttpRequest());
		assert.ok(result instanceof Promise);
		await result;
		assert.strictEqual(request.resolution, 'continue');
	});
});

describe('config validation', () => {
	it.effect('rejects a file and proxy in the same rule', () =>
		validateConfig({
			initialUrl: 'https://example.test',
			interceptor: { file: './mock.json', proxy: 'https://proxy.test' }
		}).pipe(
			Effect.flip,
			Effect.map((error) => assert.strictEqual(error._tag, 'ConfigValidationError'))
		)
	);

	it.effect('rejects launch and connect options in the same config', () =>
		validateConfig({
			initialUrl: 'https://example.test',
			puppeteerOptions: {
				launch: { headless: true },
				connect: { browserURL: 'http://127.0.0.1:9222' }
			}
		}).pipe(
			Effect.flip,
			Effect.map((error) => {
				assert.strictEqual(error._tag, 'ConfigValidationError');
				assert.strictEqual(error.message, 'puppeteerOptions cannot define both launch and connect');
			})
		)
	);

	it.effect('rejects invalid connected-browser options', () =>
		Effect.forEach(
			[
				{
					browser: { mode: 'permission' },
					message: 'browser.mode must be "auto", "remote-debugging", or "launch"'
				},
				{
					browser: { channel: 'chromium' },
					message:
						'browser.channel must be "chrome", "chrome-beta", "chrome-canary", or "chrome-dev"'
				},
				{
					browser: { indicator: 'overlay' },
					message: 'browser.indicator must be "title" or "none"'
				},
				{
					browser: { remoteDebuggingTimeout: 0 },
					message: 'browser.remoteDebuggingTimeout must be a positive finite number'
				},
				{
					browser: { closeManagedPageOnExit: 'yes' },
					message: 'browser.closeManagedPageOnExit must be a boolean'
				},
				{
					browser: { dangerouslyEnableForAllTabs: 'yes' },
					message: 'browser.dangerouslyEnableForAllTabs must be a boolean'
				}
			],
			({ browser, message }) =>
				validateConfig({ initialUrl: 'https://example.test', browser }).pipe(
					Effect.flip,
					Effect.map((error) => {
						assert.strictEqual(error._tag, 'ConfigValidationError');
						assert.strictEqual(error.message, message);
					})
				)
		).pipe(Effect.asVoid)
	);

	it.effect('rejects contradictory high-level and raw browser acquisition options', () =>
		Effect.forEach(
			[
				{
					browser: { mode: 'auto' },
					puppeteerOptions: { connect: { channel: 'chrome' } },
					message: 'browser.mode cannot be combined with puppeteerOptions.connect'
				},
				{
					browser: { channel: 'chrome' },
					puppeteerOptions: { connect: { channel: 'chrome' } },
					message: 'browser.channel cannot be combined with puppeteerOptions.connect'
				},
				{
					browser: { remoteDebuggingTimeout: 5_000 },
					puppeteerOptions: { connect: { channel: 'chrome' } },
					message: 'browser.remoteDebuggingTimeout cannot be combined with puppeteerOptions.connect'
				},
				{
					browser: { mode: 'remote-debugging' },
					puppeteerOptions: { launch: { headless: true } },
					message: 'browser.mode "remote-debugging" cannot be combined with puppeteerOptions.launch'
				},
				{
					browser: { mode: 'launch', channel: 'chrome' },
					puppeteerOptions: undefined,
					message: 'browser.channel cannot be used when browser.mode is "launch"'
				},
				{
					browser: { mode: 'launch', remoteDebuggingTimeout: 5_000 },
					puppeteerOptions: undefined,
					message: 'browser.remoteDebuggingTimeout cannot be used when browser.mode is "launch"'
				}
			],
			({ browser, puppeteerOptions, message }) =>
				validateConfig({ initialUrl: 'https://example.test', browser, puppeteerOptions }).pipe(
					Effect.flip,
					Effect.map((error) => assert.strictEqual(error.message, message))
				)
		).pipe(Effect.asVoid)
	);
});

describe('proxy cancellation', () => {
	it('composes a consumer signal with Effect interruption', async () => {
		const originalFetch = globalThis.fetch;
		const userController = new AbortController();
		let observedSignal: AbortSignal | undefined;

		globalThis.fetch = (async (_input, options) => {
			observedSignal = options?.signal ?? undefined;
			return new Response('ok');
		}) as typeof fetch;

		try {
			await Effect.runPromise(
				ProxyTransport.use((transport) =>
					transport.execute('https://example.test', 'https://proxy.test', {
						signal: userController.signal
					})
				).pipe(Effect.provide(ProxyTransport.layer))
			);
			assert.ok(observedSignal);
			assert.notStrictEqual(observedSignal, userController.signal);
			userController.abort();
			assert.isTrue(observedSignal.aborted);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('aborts fetch when the Effect fiber is interrupted', async () => {
		const originalFetch = globalThis.fetch;
		let observedSignal: AbortSignal | undefined;
		let markStarted: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});

		globalThis.fetch = ((_input, options) =>
			new Promise<Response>((_resolve, reject) => {
				observedSignal = options?.signal ?? undefined;
				markStarted?.();
				observedSignal?.addEventListener('abort', () => reject(observedSignal?.reason), {
					once: true
				});
			})) as typeof fetch;

		try {
			const fiber = Effect.runFork(
				ProxyTransport.use((transport) =>
					transport.execute('https://example.test', 'https://proxy.test', {})
				).pipe(Effect.provide(ProxyTransport.layer))
			);
			await started;
			await Effect.runPromise(Fiber.interrupt(fiber));
			assert.ok(observedSignal);
			assert.isTrue(observedSignal.aborted);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
