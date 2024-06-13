import { run } from './run';
import { program } from 'commander';
import { readConfig, ConfigLoaderError } from '@web/config-loader';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

async function loadConfig(customFile: string) {
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

program
	.version(pkg.version)
	.option('-f, --file <file>', 'config file to use')
	.action(async (commandConfigs) => {
		const fileConfigs = await loadConfig(commandConfigs.file);
		const configs = { ...commandConfigs, ...fileConfigs };
		run(configs);
	});

program.parse(process.argv);
