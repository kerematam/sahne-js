// @ts-check
import { defineConfig } from 'sahne-js';
import assert from 'assert';

const target = 'http://localhost:8080';
const devTarget = 'http://localhost:5173';

const success = '\x1b[32m';
const fail = '\x1b[31m';
const reset = `\x1b[0m`;

const successMessage = (message) => console.log(success, message, reset);
const failMessage = (message) => console.log(fail, message, reset);

const checkIfProxyRequestWorks = async (browser, page) => {
	const content = await page.$eval('.sahne-title', (el) => el.textContent.trim());
	assert.strictEqual(content, 'This is update from SahneJS');
	successMessage('Proxy request works.');
};

const checkIfIgnoreApiCallWorks = async (browser, page) => {
	const todoCount = await page.$$eval('#todo-item', (items) => items.length);
	assert.strictEqual(todoCount, 10);
	successMessage('Ingore intercept request works.');
};

const checkIfProxyFileReadWorks = async (browser, page) => {
	const content = await page.$eval('.sahne-content-from-file-read', (el) => el.textContent.trim());
	assert.strictEqual(content, 'This is content from file read');
};

const checkIfCookieOverrideWorks = async (browser, page) => {
	const content = await page.$eval('.sahne-content-from-file-read', (el) => el.textContent.trim());
	assert.strictEqual(content, 'This is content from file read');
};

const checkIfHeaderOverrideWorks = async (browser, page) => {
	// const content = await page.$eval('.sahne-content-from-file-read', (el) => el.textContent.trim());
	// assert.strictEqual(content, 'This is content from file read');
};

const checkIfBodyOverrideWorks = async (browser, page) => {
	// const content = await page.$eval('.sahne-content-from-file-read', (el) => el.textContent.trim());
	// assert.strictEqual(content, 'This is content from file read');
};

const checkIfFallbackWorks = async (browser, page) => {};

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
				await checkIfIgnoreApiCallWorks(browser, page);
				successMessage('defineConfig test passed!');
			} catch (err) {
				console.error(fail, 'Test failed', err);
				// process.exit(1);
			} finally {
				// await browser.close();
			}
		}
	}
});
