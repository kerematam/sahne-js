import * as NodeFileSystem from '@effect/platform-node-shared/NodeFileSystem';
import { assert, describe, it } from '@effect/vitest';
import { Effect } from 'effect';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { formatSahneError } from '../src/errors.js';

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
