import { Effect, FileSystem } from 'effect';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ConfigLoadError, ConfigValidationError } from './errors.js';
import type { InterceptorConfig, SahneConfig } from './types.js';

const validateInterceptor = (config: unknown, index: number): ConfigValidationError | undefined => {
	if (typeof config !== 'object' || config === null) {
		return new ConfigValidationError({ message: `interceptor[${index}] must be an object` });
	}

	const value = config as Record<string, unknown>;
	if (value.file !== undefined && value.proxy !== undefined) {
		return new ConfigValidationError({
			message: `interceptor[${index}] cannot define both file and proxy`
		});
	}
	if (
		value.file !== undefined &&
		typeof value.file !== 'string' &&
		typeof value.file !== 'function'
	) {
		return new ConfigValidationError({
			message: `interceptor[${index}].file must be a string or function`
		});
	}
	if (
		value.proxy !== undefined &&
		typeof value.proxy !== 'string' &&
		typeof value.proxy !== 'function'
	) {
		return new ConfigValidationError({
			message: `interceptor[${index}].proxy must be a string or function`
		});
	}

	return undefined;
};

export const validateConfig = (
	input: unknown
): Effect.Effect<SahneConfig, ConfigValidationError> => {
	if (typeof input !== 'object' || input === null) {
		return Effect.fail(new ConfigValidationError({ message: 'Sahne config must be an object' }));
	}

	const config = input as Record<string, unknown>;
	if (typeof config.initialUrl !== 'string' || config.initialUrl.length === 0) {
		return Effect.fail(
			new ConfigValidationError({ message: 'Sahne config initialUrl must be a non-empty string' })
		);
	}

	try {
		const initialUrl = new URL(config.initialUrl);
		if (initialUrl.protocol !== 'http:' && initialUrl.protocol !== 'https:') {
			throw new Error('unsupported protocol');
		}
	} catch {
		return Effect.fail(
			new ConfigValidationError({
				message: 'Sahne config initialUrl must be an absolute HTTP or HTTPS URL'
			})
		);
	}

	if (config.puppeteerOptions !== undefined) {
		if (typeof config.puppeteerOptions !== 'object' || config.puppeteerOptions === null) {
			return Effect.fail(
				new ConfigValidationError({ message: 'puppeteerOptions must be an object' })
			);
		}

		const puppeteerOptions = config.puppeteerOptions as Record<string, unknown>;
		if (puppeteerOptions.launch !== undefined && puppeteerOptions.connect !== undefined) {
			return Effect.fail(
				new ConfigValidationError({
					message: 'puppeteerOptions cannot define both launch and connect'
				})
			);
		}
		for (const name of ['launch', 'connect'] as const) {
			const options = puppeteerOptions[name];
			if (
				options !== undefined &&
				(typeof options !== 'object' || options === null || Array.isArray(options))
			) {
				return Effect.fail(
					new ConfigValidationError({
						message: `puppeteerOptions.${name} must be an object`
					})
				);
			}
		}
	}

	if (config.browser !== undefined) {
		if (
			typeof config.browser !== 'object' ||
			config.browser === null ||
			Array.isArray(config.browser)
		) {
			return Effect.fail(new ConfigValidationError({ message: 'browser must be an object' }));
		}

		const browser = config.browser as Record<string, unknown>;
		if (
			browser.mode !== undefined &&
			browser.mode !== 'auto' &&
			browser.mode !== 'remote-debugging' &&
			browser.mode !== 'launch'
		) {
			return Effect.fail(
				new ConfigValidationError({
					message: 'browser.mode must be "auto", "remote-debugging", or "launch"'
				})
			);
		}
		if (
			browser.channel !== undefined &&
			browser.channel !== 'chrome' &&
			browser.channel !== 'chrome-beta' &&
			browser.channel !== 'chrome-canary' &&
			browser.channel !== 'chrome-dev'
		) {
			return Effect.fail(
				new ConfigValidationError({
					message:
						'browser.channel must be "chrome", "chrome-beta", "chrome-canary", or "chrome-dev"'
				})
			);
		}

		const puppeteerOptions = config.puppeteerOptions as Record<string, unknown> | undefined;
		if (browser.mode !== undefined && puppeteerOptions?.connect !== undefined) {
			return Effect.fail(
				new ConfigValidationError({
					message: 'browser.mode cannot be combined with puppeteerOptions.connect'
				})
			);
		}
		if (browser.channel !== undefined && puppeteerOptions?.connect !== undefined) {
			return Effect.fail(
				new ConfigValidationError({
					message: 'browser.channel cannot be combined with puppeteerOptions.connect'
				})
			);
		}
		if (browser.remoteDebuggingTimeout !== undefined && puppeteerOptions?.connect !== undefined) {
			return Effect.fail(
				new ConfigValidationError({
					message: 'browser.remoteDebuggingTimeout cannot be combined with puppeteerOptions.connect'
				})
			);
		}
		if (browser.mode === 'remote-debugging' && puppeteerOptions?.launch !== undefined) {
			return Effect.fail(
				new ConfigValidationError({
					message: 'browser.mode "remote-debugging" cannot be combined with puppeteerOptions.launch'
				})
			);
		}
		if (browser.mode === 'launch' && browser.channel !== undefined) {
			return Effect.fail(
				new ConfigValidationError({
					message: 'browser.channel cannot be used when browser.mode is "launch"'
				})
			);
		}
		if (browser.mode === 'launch' && browser.remoteDebuggingTimeout !== undefined) {
			return Effect.fail(
				new ConfigValidationError({
					message: 'browser.remoteDebuggingTimeout cannot be used when browser.mode is "launch"'
				})
			);
		}
		if (
			browser.remoteDebuggingTimeout !== undefined &&
			(typeof browser.remoteDebuggingTimeout !== 'number' ||
				!Number.isFinite(browser.remoteDebuggingTimeout) ||
				browser.remoteDebuggingTimeout <= 0)
		) {
			return Effect.fail(
				new ConfigValidationError({
					message: 'browser.remoteDebuggingTimeout must be a positive finite number'
				})
			);
		}
		if (
			browser.indicator !== undefined &&
			browser.indicator !== 'title' &&
			browser.indicator !== 'none'
		) {
			return Effect.fail(
				new ConfigValidationError({ message: 'browser.indicator must be "title" or "none"' })
			);
		}
		for (const name of ['closeManagedPageOnExit', 'dangerouslyEnableForAllTabs'] as const) {
			if (browser[name] !== undefined && typeof browser[name] !== 'boolean') {
				return Effect.fail(
					new ConfigValidationError({ message: `browser.${name} must be a boolean` })
				);
			}
		}
	}

	if (config.callback !== undefined) {
		if (typeof config.callback !== 'object' || config.callback === null) {
			return Effect.fail(new ConfigValidationError({ message: 'callback must be an object' }));
		}
		for (const name of ['beforeLaunch', 'afterLaunch', 'beforeGoto', 'afterGoto'] as const) {
			const callback = (config.callback as Record<string, unknown>)[name];
			if (callback !== undefined && typeof callback !== 'function') {
				return Effect.fail(
					new ConfigValidationError({ message: `callback.${name} must be a function` })
				);
			}
		}
	}

	if (config.interceptor !== undefined) {
		const interceptors = Array.isArray(config.interceptor)
			? config.interceptor
			: [config.interceptor];
		for (const [index, interceptor] of interceptors.entries()) {
			const error = validateInterceptor(interceptor, index);
			if (error) return Effect.fail(error);
		}
	}

	return Effect.succeed(config as unknown as SahneConfig);
};

export const loadConfig = (
	customFile?: string
): Effect.Effect<SahneConfig, ConfigLoadError | ConfigValidationError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const configPath = resolve(customFile ?? 'sahne.config.ts');
		const fs = yield* FileSystem.FileSystem;
		const exists = yield* fs.exists(configPath).pipe(
			Effect.mapError(
				(cause) =>
					new ConfigLoadError({
						path: configPath,
						cause,
						message: `Could not access config file at ${configPath}`
					})
			)
		);
		if (!exists) {
			return yield* new ConfigLoadError({
				path: configPath,
				cause: new Error('Config file not found'),
				message: customFile
					? `Could not find a config file at ${configPath}`
					: 'Could not find a sahne.config file.'
			});
		}

		const configModule = yield* Effect.tryPromise({
			try: () => import(pathToFileURL(configPath).href),
			catch: (cause) =>
				new ConfigLoadError({
					path: configPath,
					cause,
					message: `Could not load config file at ${configPath}`
				})
		});
		return yield* validateConfig(configModule.default ?? configModule);
	});

export const validateInterceptorConfig = (
	config: InterceptorConfig | ReadonlyArray<InterceptorConfig>
): Effect.Effect<void, ConfigValidationError> => {
	const configs = Array.isArray(config) ? config : [config];
	for (const [index, value] of configs.entries()) {
		const error = validateInterceptor(value, index);
		if (error) return Effect.fail(error);
	}
	return Effect.void;
};
