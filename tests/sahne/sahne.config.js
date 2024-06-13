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

	const todoCount = await page.$$eval('#todo-item', (items) => items.length);
	assert.strictEqual(todoCount, 10);
};

export default defineConfig({
	initialUrl: target,
	puppeteerOptions: {
		// launch: {
		// 	args: ['--proxy-server=socks5h://localhost:1080']
		// }
	},
	interceptor: [
		{
			match: `${target}/**`,
			// fallback: `${target}/hello`,
			proxy: devTarget,
			ignore: `${target}/api/**`
			// onProxyFail: (error) => {
			// 	console.log('onProxyFail', error);
			// }
		}
		// {
		// 	match: `${target}/api/1.json`,
		// 	file: './1.json'
		// }
	],
	callback: {
		// INFO: this is for CLI testing
		afterGoto: async (browser, page) => {
			try {
				await checkIfProxyRequestWorks(browser, page);
				successMessage('CLI command works!');
			} catch (err) {
				console.error(fail, 'Test failed', err);
				process.exit(1);
			} finally {
				await browser.close();
			}
		}
	}
});
