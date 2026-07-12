import * as NodeFileSystem from '@effect/platform-node-shared/NodeFileSystem';
import { assert, describe, it } from '@effect/vitest';
import { Effect } from 'effect';
import { fileURLToPath } from 'node:url';
import { loadConfig, validateConfig, validateInterceptorConfig } from '../src/config.js';
import { formatSahneError } from '../src/errors.js';
import type { InterceptorConfig } from '../src/types.js';

describe('config loading', () => {
	it.effect('reports the native module import failure without Effect internals', () => {
		const path = fileURLToPath(new URL('./fixtures/missing-package.config.mjs', import.meta.url));

		return loadConfig(path).pipe(
			Effect.provide(NodeFileSystem.layer),
			Effect.flip,
			Effect.map((error) => {
				assert.strictEqual(error._tag, 'ConfigLoadError');
				const output = formatSahneError(error);
				assert.include(output, `Could not load config file at ${path}`);
				assert.include(output, 'sahne-js-missing-config-dependency');
				assert.notInclude(output, 'FiberFailure');
				assert.notInclude(output, 'at ModuleLoader');
			})
		);
	});
});

const expectInvalidConfig = (input: unknown, message: string) =>
	validateConfig(input).pipe(
		Effect.flip,
		Effect.map((error) => {
			assert.strictEqual(error._tag, 'ConfigValidationError');
			assert.strictEqual(error.message, message);
		})
	);

describe('Effect Schema config validation', () => {
	it.effect('rejects non-object top-level values and arrays', () =>
		Effect.forEach([null, [], () => undefined, 'config', 1, true], (input) =>
			expectInvalidConfig(input, 'Sahne config must be an object')
		).pipe(Effect.asVoid)
	);

	it.effect('validates the initial URL without changing its public string representation', () =>
		Effect.forEach(
			[
				{
					input: {},
					message: 'Sahne config initialUrl must be a non-empty string'
				},
				{
					input: { initialUrl: 1 },
					message: 'Sahne config initialUrl must be a non-empty string'
				},
				{
					input: { initialUrl: '' },
					message: 'Sahne config initialUrl must be a non-empty string'
				},
				{
					input: { initialUrl: '/relative' },
					message: 'Sahne config initialUrl must be an absolute HTTP or HTTPS URL'
				},
				{
					input: { initialUrl: 'ftp://example.test' },
					message: 'Sahne config initialUrl must be an absolute HTTP or HTTPS URL'
				}
			],
			({ input, message }) => expectInvalidConfig(input, message)
		).pipe(Effect.asVoid)
	);

	it.effect('rejects arrays and other invalid values at object-only boundaries', () =>
		Effect.forEach(
			[
				{
					config: { puppeteerOptions: [] },
					message: 'puppeteerOptions must be an object'
				},
				{
					config: { puppeteerOptions: () => undefined },
					message: 'puppeteerOptions must be an object'
				},
				{
					config: { puppeteerOptions: { goto: [] } },
					message: 'puppeteerOptions.goto must be an object'
				},
				{
					config: { puppeteerOptions: { launch: [] } },
					message: 'puppeteerOptions.launch must be an object'
				},
				{
					config: { puppeteerOptions: { connect: null } },
					message: 'puppeteerOptions.connect must be an object'
				},
				{
					config: { browser: [] },
					message: 'browser must be an object'
				},
				{
					config: { browser: null },
					message: 'browser must be an object'
				},
				{
					config: { callback: [] },
					message: 'callback must be an object'
				},
				{
					config: { callback: { beforeGoto: 'not a function' } },
					message: 'callback.beforeGoto must be a function'
				}
			],
			({ config, message }) =>
				expectInvalidConfig({ initialUrl: 'https://example.test', ...config }, message)
		).pipe(Effect.asVoid)
	);

	it.effect('requires a positive finite remote-debugging timeout', () =>
		Effect.forEach([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '5000'], (timeout) =>
			expectInvalidConfig(
				{
					initialUrl: 'https://example.test',
					browser: { remoteDebuggingTimeout: timeout }
				},
				'browser.remoteDebuggingTimeout must be a positive finite number'
			)
		).pipe(Effect.asVoid)
	);

	it.effect('accepts explicit undefined for optional fields', () =>
		validateConfig({
			initialUrl: 'https://example.test',
			puppeteerOptions: {
				goto: undefined,
				launch: undefined,
				connect: undefined
			},
			browser: {
				mode: undefined,
				channel: undefined,
				remoteDebuggingTimeout: undefined,
				indicator: undefined,
				closeManagedPageOnExit: undefined,
				dangerouslyEnableForAllTabs: undefined
			},
			callback: {
				beforeLaunch: undefined,
				afterLaunch: undefined,
				beforeGoto: undefined,
				afterGoto: undefined
			},
			interceptor: {
				file: undefined,
				proxy: undefined
			}
		}).pipe(Effect.asVoid)
	);

	it.effect('reports interceptor object, field, and array-index paths', () =>
		Effect.forEach(
			[
				{
					interceptor: null,
					message: 'interceptor[0] must be an object'
				},
				{
					interceptor: [{}, null],
					message: 'interceptor[1] must be an object'
				},
				{
					interceptor: { file: 1 },
					message: 'interceptor[0].file must be a string or function'
				},
				{
					interceptor: { proxy: false },
					message: 'interceptor[0].proxy must be a string or function'
				},
				{
					interceptor: { match: 1 },
					message:
						'interceptor[0].match must be a string, RegExp, function, or array of those values'
				},
				{
					interceptor: { match: ['valid', 1] },
					message:
						'interceptor[0].match must be a string, RegExp, function, or array of those values'
				},
				{
					interceptor: { onRequest: 'not a function' },
					message: 'interceptor[0].onRequest must be a function'
				},
				{
					interceptor: { file: './mock.json', proxy: 'https://proxy.test' },
					message: 'interceptor[0] cannot define both file and proxy'
				}
			],
			({ interceptor, message }) =>
				expectInvalidConfig({ initialUrl: 'https://example.test', interceptor }, message)
		).pipe(Effect.asVoid)
	);

	it.effect('reuses the interceptor schema for direct validation', () =>
		validateInterceptorConfig([
			{},
			{ file: 1 }
		] as unknown as ReadonlyArray<InterceptorConfig>).pipe(
			Effect.flip,
			Effect.map((error) =>
				assert.strictEqual(error.message, 'interceptor[1].file must be a string or function')
			)
		)
	);

	it.effect('preserves config and executable value identity', () => {
		const beforeLaunch = () => undefined;
		const match = /example\.test/gi;
		const rewrite = (path: string) => path;
		const connect = {
			browserURL: 'http://127.0.0.1:9222',
			protocolTimeout: 5_000,
			customTransportFactory: () => undefined
		};
		const customTopLevel = { retained: true };
		const config = {
			initialUrl: 'https://example.test',
			puppeteerOptions: { connect },
			callback: { beforeLaunch },
			interceptor: {
				match,
				pathRewrite: rewrite,
				customInterceptorOption: { retained: true }
			},
			customTopLevel
		};

		return validateConfig(config).pipe(
			Effect.map((validated) => {
				assert.strictEqual(validated, config);
				assert.strictEqual(validated.callback?.beforeLaunch, beforeLaunch);
				assert.strictEqual(validated.puppeteerOptions?.connect, connect);
				const interceptor = Array.isArray(validated.interceptor)
					? validated.interceptor[0]
					: validated.interceptor;
				assert.strictEqual(interceptor?.match, match);
				assert.strictEqual(interceptor?.pathRewrite, rewrite);
				assert.strictEqual(
					(validated as unknown as { customTopLevel: unknown }).customTopLevel,
					customTopLevel
				);
			})
		);
	});
});
