import { run } from './run';
import { program } from 'commander';
import { readConfig, ConfigLoaderError } from '@web/config-loader';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

async function loadConfig() {
	try {
		const config = await readConfig('sahne.config');
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
	// TODO: add options to the CLI
	// .option(
	//   "-t, --target <target>",
	//   "URL origin to the target server that requests will be intercepted and proxied from"
	// )
	.action(async (commandConfigs) => {
		// const run = await loadModule();

		const fileConfigs = await loadConfig();
		const configs = { ...commandConfigs, ...fileConfigs };
		run(configs);
	});

program.parse(process.argv);
