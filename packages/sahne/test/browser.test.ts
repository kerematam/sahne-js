import { assert, describe, it } from '@effect/vitest';
import { Effect } from 'effect';
import {
	resolveBrowserPolicy,
	supportsRemoteDebuggingMode,
	type BrowserRuntimeEnvironment
} from '../src/browser.js';
import type { SahneConfig } from '../src/types.js';

const config = (overrides: Partial<SahneConfig> = {}): SahneConfig => ({
	initialUrl: 'https://example.test',
	...overrides
});

const environment = (
	overrides: Partial<BrowserRuntimeEnvironment> = {}
): BrowserRuntimeEnvironment => ({
	stdinIsTTY: true,
	stdoutIsTTY: true,
	...overrides
});

describe('browser policy', () => {
	it.effect('preserves raw Puppeteer connect and launch configuration', () =>
		Effect.gen(function* () {
			const connectPolicy = yield* resolveBrowserPolicy(
				config({
					puppeteerOptions: { connect: { browserURL: 'http://127.0.0.1:9222' } },
					browser: { indicator: 'none' }
				}),
				{ environment: environment() }
			);
			const launchPolicy = yield* resolveBrowserPolicy(
				config({
					puppeteerOptions: { launch: { headless: true } },
					browser: { closeManagedPageOnExit: false }
				}),
				{ environment: environment() }
			);

			assert.deepEqual(connectPolicy, { _tag: 'RawConnect' });
			assert.deepEqual(launchPolicy, { _tag: 'RawLaunch' });
		})
	);

	it.effect('defaults auto mode to Chrome remote debugging in an interactive terminal', () =>
		resolveBrowserPolicy(config(), { environment: environment() }).pipe(
			Effect.map((policy) =>
				assert.deepEqual(policy, {
					_tag: 'RemoteDebugging',
					channel: 'chrome',
					requestedMode: 'auto'
				})
			)
		)
	);

	it.effect('defaults auto mode to launch in CI or a non-interactive terminal', () =>
		Effect.forEach(
			[
				environment({ ci: 'true' }),
				environment({ stdinIsTTY: false }),
				environment({ stdoutIsTTY: false })
			],
			(runtime) =>
				resolveBrowserPolicy(config(), { environment: runtime }).pipe(
					Effect.map((policy) =>
						assert.deepEqual(policy, { _tag: 'Launch', requestedMode: 'auto' })
					)
				)
		).pipe(Effect.asVoid)
	);

	it.effect('treats conventional false-like CI values as interactive', () =>
		Effect.forEach(['', '0', 'false', 'no', 'off', ' FALSE '], (ci) =>
			resolveBrowserPolicy(config(), { environment: environment({ ci }) }).pipe(
				Effect.map((policy) => assert.strictEqual(policy._tag, 'RemoteDebugging'))
			)
		).pipe(Effect.asVoid)
	);

	it.effect('treats other non-empty CI values as truthy', () =>
		Effect.forEach(['1', 'true', 'yes', 'on', 'buildkite', ' YES '], (ci) =>
			resolveBrowserPolicy(config(), { environment: environment({ ci }) }).pipe(
				Effect.map((policy) => assert.strictEqual(policy._tag, 'Launch'))
			)
		).pipe(Effect.asVoid)
	);

	it.effect('gives a CLI mode override precedence over env, config, and raw options', () =>
		resolveBrowserPolicy(
			config({
				browser: { mode: 'launch' },
				puppeteerOptions: { launch: { headless: true } }
			}),
			{
				environment: environment({ browserMode: 'launch' }),
				modeOverride: 'remote-debugging'
			}
		).pipe(
			Effect.map((policy) =>
				assert.deepEqual(policy, {
					_tag: 'RemoteDebugging',
					channel: 'chrome',
					requestedMode: 'remote-debugging'
				})
			)
		)
	);

	it.effect('gives SAHNE_BROWSER_MODE precedence over config mode', () =>
		resolveBrowserPolicy(config({ browser: { mode: 'launch' } }), {
			environment: environment({ browserMode: 'remote-debugging' })
		}).pipe(
			Effect.map((policy) =>
				assert.deepEqual(policy, {
					_tag: 'RemoteDebugging',
					channel: 'chrome',
					requestedMode: 'remote-debugging'
				})
			)
		)
	);

	it.effect('rejects an invalid SAHNE_BROWSER_MODE', () =>
		resolveBrowserPolicy(config(), {
			environment: environment({ browserMode: 'connect' })
		}).pipe(
			Effect.flip,
			Effect.map((error) => {
				assert.strictEqual(error._tag, 'ConfigValidationError');
				assert.strictEqual(
					error.message,
					'SAHNE_BROWSER_MODE must be "auto", "remote-debugging", or "launch"'
				);
			})
		)
	);

	it.effect('uses the configured channel in explicit remote-debugging mode', () =>
		resolveBrowserPolicy(
			config({ browser: { mode: 'remote-debugging', channel: 'chrome-beta' } }),
			{ environment: environment({ ci: 'true' }) }
		).pipe(
			Effect.map((policy) =>
				assert.deepEqual(policy, {
					_tag: 'RemoteDebugging',
					channel: 'chrome-beta',
					requestedMode: 'remote-debugging'
				})
			)
		)
	);

	it.effect('treats a configured channel as an auto-mode customization', () =>
		resolveBrowserPolicy(
			config({
				browser: { channel: 'chrome-canary' },
				puppeteerOptions: { launch: { headless: true } }
			}),
			{ environment: environment() }
		).pipe(
			Effect.map((policy) =>
				assert.deepEqual(policy, {
					_tag: 'RemoteDebugging',
					channel: 'chrome-canary',
					requestedMode: 'auto'
				})
			)
		)
	);
});

describe('remote-debugging Puppeteer support', () => {
	it.effect('starts at Puppeteer 24.32.0', () =>
		Effect.sync(() => {
			assert.isFalse(supportsRemoteDebuggingMode('24.31.999'));
			assert.isTrue(supportsRemoteDebuggingMode('24.32.0'));
			assert.isTrue(supportsRemoteDebuggingMode('24.32.0-next.1'));
			assert.isTrue(supportsRemoteDebuggingMode('25.0.0'));
			assert.isFalse(supportsRemoteDebuggingMode('23.99.99'));
			assert.isFalse(supportsRemoteDebuggingMode('not-a-version'));
		})
	);
});
