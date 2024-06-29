// @ts-check
import { defineConfig } from 'sahne-js';
import assert from 'assert';

const target = 'http://localhost:8080';
const devTarget = 'http://localhost:5173';

const successColor = '\x1b[32m';
const fail = '\x1b[31m';
const resetColor = `\x1b[0m`;
const successMessage = (message) => console.log(successColor, '✓ ', resetColor, message);

const checkIfProxyRequestWorks = async (browser, page) => {
	const content = await page.$eval('.sahne-title', (el) => el.textContent.trim());
	assert.strictEqual(content, 'This is update from SahneJS');
};

export default defineConfig({
	initialUrl: target,
	interceptor: [
		{
			match: `${target}/**`,
			proxy: devTarget,
			ignore: `${target}/api/**`
		}
	],
	puppeteerOptions: {
		launch: {
			headless: true
		}
	},
	callback: {
		// INFO: this is for CLI testing
		afterGoto: async (browser, page) => {
			try {
				await checkIfProxyRequestWorks(browser, page);
				successMessage('CLI command works!');
				process.exit();
			} catch (err) {
				console.error(fail, 'CLI Test failed', err);
				process.exit('1');
			}
		}
	}
});
