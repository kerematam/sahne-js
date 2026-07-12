import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const packageManifest = JSON.parse(readFileSync(join(root, 'packages/sahne/package.json'), 'utf8'));
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'sahne-pack-'));
const npmEnvironment = {
	...process.env,
	PUPPETEER_SKIP_DOWNLOAD: 'true',
	npm_config_cache: join(temporaryDirectory, '.npm-cache')
};

try {
	const packageName = execFileSync(
		'npm',
		['pack', '--workspace', 'sahne-js', '--pack-destination', temporaryDirectory],
		{ cwd: root, encoding: 'utf8', env: npmEnvironment }
	)
		.trim()
		.split('\n')
		.at(-1);
	assert.ok(packageName);

	writeFileSync(
		join(temporaryDirectory, 'package.json'),
		JSON.stringify({ name: 'sahne-pack-smoke', private: true, type: 'module' })
	);
	execFileSync(
		'npm',
		[
			'install',
			join(temporaryDirectory, packageName),
			'puppeteer@25.3.0',
			'--ignore-scripts',
			'--package-lock=false'
		],
		{
			cwd: temporaryDirectory,
			stdio: 'inherit',
			env: npmEnvironment
		}
	);

	writeFileSync(
		join(temporaryDirectory, 'smoke.mjs'),
		"import { defineConfig, Interceptor } from 'sahne-js';\n" +
			"const config = defineConfig({ initialUrl: 'https://example.test' });\n" +
			"if (config.initialUrl !== 'https://example.test' || typeof Interceptor !== 'function') process.exit(1);\n"
	);
	execFileSync('node', ['smoke.mjs'], { cwd: temporaryDirectory, stdio: 'inherit' });

	const version = execFileSync(join(temporaryDirectory, 'node_modules/.bin/sahne'), ['--version'], {
		cwd: temporaryDirectory,
		encoding: 'utf8'
	}).trim();
	assert.equal(version, packageManifest.version);

	const declaration = readFileSync(
		join(temporaryDirectory, 'node_modules/sahne-js/dist/index.d.ts'),
		'utf8'
	);
	assert.match(declaration, /Interceptor/);
} finally {
	rmSync(temporaryDirectory, { recursive: true, force: true });
}
