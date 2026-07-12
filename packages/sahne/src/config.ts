import { Effect, FileSystem } from 'effect';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateConfigSchema, validateInterceptorConfigSchema } from './configSchema.js';
import { ConfigLoadError, type ConfigValidationError } from './errors.js';
import type { InterceptorConfig, SahneConfig } from './types.js';

export const validateConfig = validateConfigSchema;

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
): Effect.Effect<void, ConfigValidationError> => validateInterceptorConfigSchema(config);
