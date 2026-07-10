#!/usr/bin/env node

import { program } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run } from './run.js';
import type { SahneConfig } from './types.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

async function loadConfig(customFile?: string): Promise<SahneConfig | undefined> {
	try {
		const configPath = resolve(customFile ?? 'sahne.config.ts');

		if (!existsSync(configPath)) {
			throw new Error(
				customFile
					? `Could not find a config file at ${configPath}`
					: 'Could not find a sahne.config file.'
			);
		}

		const configModule = await import(pathToFileURL(configPath).href);
		return (configModule.default ?? configModule) as SahneConfig;
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		return;
	}
}

program
	.name('sahne')
	.version(pkg.version)
	.option('-f, --file <file>', 'config file to use')
	.action(async (commandConfigs) => {
		const fileConfigs = await loadConfig(commandConfigs.file);
		if (!fileConfigs) return;
		const configs = { ...commandConfigs, ...fileConfigs };
		await run(configs);
	});

program.parseAsync(process.argv).catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
