#!/usr/bin/env node
const { program } = require('commander');
const { readConfig, ConfigLoaderError } = require('@web/config-loader');

async function loadConfig(customFile) {
	try {
		const config = await readConfig('sahne.config', customFile);
		return config;
	} catch (error) {
		if (error instanceof ConfigLoaderError) {
			console.error(error.message);
			return;
		}
		console.error(error);
		return;
	}
}

async function loadModule() {
	const esModule = await import('./src/index.mjs');
	return esModule.default;
}

program
	.version('1.0.0')
	.option('-f, --file <file>', 'config file to use')
	.action(async (commandConfigs) => {
		const run = await loadModule();
		const fileConfigs = await loadConfig(commandConfigs.file);
		const configs = { ...commandConfigs, ...fileConfigs };
		run(configs);
	});

program.parse(process.argv);
