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
