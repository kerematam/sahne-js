import assert from 'node:assert/strict';
import type { Browser, Page } from 'puppeteer';
import { defineConfig } from 'sahne-js';

const target = 'http://localhost:8080';
const devTarget = 'http://localhost:5173';

const successColor = '\x1b[32m';
const failColor = '\x1b[31m';
const resetColor = '\x1b[0m';

const checkIfProxyRequestWorks = async (_browser: Browser, page: Page) => {
	const content = await page.$eval('.sahne-title', (element) => element.textContent?.trim());
	assert.strictEqual(content, 'This is update from SahneJS');
};

export default defineConfig({
	initialUrl: target,
	interceptor: {
		match: `${target}/**`,
		proxy: devTarget,
		ignore: `${target}/api/**`
	},
	puppeteerOptions: {
		launch: {
			headless: true
		}
	},
	callback: {
		afterGoto: async (browser, page) => {
			try {
				await checkIfProxyRequestWorks(browser, page);
				console.log(successColor, '✓ ', resetColor, 'CLI command works!');
				process.exit(0);
			} catch (error) {
				console.error(failColor, 'CLI Test failed', error);
				process.exit(1);
			}
		}
	}
});
