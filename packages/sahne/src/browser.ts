import { Effect } from 'effect';
import { ConfigValidationError } from './errors.js';
import type { SahneBrowserChannel, SahneBrowserMode, SahneConfig } from './types.js';

export type BrowserRuntimeEnvironment = {
	readonly browserMode?: string;
	readonly ci?: string;
	readonly stdinIsTTY: boolean;
	readonly stdoutIsTTY: boolean;
};

export type BrowserPolicy =
	| { readonly _tag: 'RawConnect'; readonly profileDirectory?: string }
	| { readonly _tag: 'RawLaunch' }
	| {
			readonly _tag: 'RemoteDebugging';
			readonly channel: SahneBrowserChannel;
			readonly profileDirectory?: string;
			readonly requestedMode: 'auto' | 'remote-debugging';
	  }
	| {
			readonly _tag: 'Launch';
			readonly requestedMode: 'auto' | 'launch';
	  };

export type BrowserPolicyOptions = {
	readonly environment?: BrowserRuntimeEnvironment;
	readonly modeOverride?: SahneBrowserMode;
};

const browserModes: ReadonlyArray<SahneBrowserMode> = ['auto', 'remote-debugging', 'launch'];

const currentEnvironment = (): BrowserRuntimeEnvironment => ({
	browserMode: process.env.SAHNE_BROWSER_MODE,
	ci: process.env.CI,
	stdinIsTTY: process.stdin.isTTY === true,
	stdoutIsTTY: process.stdout.isTTY === true
});

const isTruthyEnvironmentValue = (value: string | undefined): boolean => {
	if (value === undefined) return false;
	const normalized = value.trim().toLowerCase();
	return normalized !== '' && !['0', 'false', 'no', 'off'].includes(normalized);
};

export const isInteractiveBrowserEnvironment = (environment: BrowserRuntimeEnvironment): boolean =>
	!isTruthyEnvironmentValue(environment.ci) && environment.stdinIsTTY && environment.stdoutIsTTY;

const parseEnvironmentMode = (
	value: string | undefined
): Effect.Effect<SahneBrowserMode | undefined, ConfigValidationError> => {
	if (value === undefined || value.trim() === '') return Effect.succeed(undefined);
	const normalized = value.trim();
	if (browserModes.includes(normalized as SahneBrowserMode)) {
		return Effect.succeed(normalized as SahneBrowserMode);
	}
	return Effect.fail(
		new ConfigValidationError({
			message: 'SAHNE_BROWSER_MODE must be "auto", "remote-debugging", or "launch"'
		})
	);
};

export const resolveBrowserPolicy = (
	config: SahneConfig,
	options: BrowserPolicyOptions = {}
): Effect.Effect<BrowserPolicy, ConfigValidationError> =>
	Effect.gen(function* () {
		const profileDirectory = config.browser?.profileDirectory;
		const profile = profileDirectory === undefined ? {} : { profileDirectory };
		const environment = options.environment ?? currentEnvironment();
		// A malformed SAHNE_BROWSER_MODE is a configuration error even where an
		// explicit connection ignores its value.
		const environmentMode =
			options.modeOverride === undefined
				? yield* parseEnvironmentMode(environment.browserMode)
				: undefined;

		if (config.puppeteerOptions?.connect !== undefined) {
			if (options.modeOverride !== undefined) {
				return yield* new ConfigValidationError({
					message: '--browser cannot be combined with explicit puppeteerOptions.connect'
				});
			}
			// Explicit connections are independent of ambient mode, CI and TTY state.
			// Static combinations (launch, mode, channel, BiDi profiles) are rejected
			// by the config schema.
			return { _tag: 'RawConnect', ...profile };
		}

		const configuredMode = config.browser?.mode;
		const requestedMode = options.modeOverride ?? environmentMode ?? configuredMode;
		if (profileDirectory !== undefined && requestedMode !== 'remote-debugging') {
			const override =
				options.modeOverride !== undefined
					? `--browser=${options.modeOverride}`
					: environmentMode !== undefined
						? `SAHNE_BROWSER_MODE=${environmentMode}`
						: undefined;
			return yield* new ConfigValidationError({
				message:
					override === undefined
						? 'browser.profileDirectory requires an explicit connection: puppeteerOptions.connect or browser.mode "remote-debugging"'
						: `${override} cannot be combined with browser.profileDirectory; keep browser.mode "remote-debugging" or drop the profile for this run`
			});
		}

		if (
			requestedMode === undefined &&
			config.browser?.channel === undefined &&
			config.browser?.remoteDebuggingTimeout === undefined &&
			config.puppeteerOptions?.launch !== undefined
		)
			return { _tag: 'RawLaunch' };

		const mode = requestedMode ?? 'auto';
		if (mode === 'launch') return { _tag: 'Launch', requestedMode: 'launch' };
		if (mode === 'remote-debugging') {
			return {
				_tag: 'RemoteDebugging',
				channel: config.browser?.channel ?? 'chrome',
				requestedMode: mode,
				...profile
			};
		}

		return isInteractiveBrowserEnvironment(environment)
			? {
					_tag: 'RemoteDebugging',
					channel: config.browser?.channel ?? 'chrome',
					requestedMode: 'auto'
				}
			: { _tag: 'Launch', requestedMode: 'auto' };
	});

export const supportsRemoteDebuggingMode = (puppeteerVersion: string): boolean => {
	const match = /^(\d+)\.(\d+)\.(\d+)/.exec(puppeteerVersion);
	if (match === null) return false;
	const major = Number(match[1]);
	const minor = Number(match[2]);
	return major > 24 || (major === 24 && minor >= 32);
};
