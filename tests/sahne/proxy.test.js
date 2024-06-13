import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer from 'puppeteer';
import { handleInterceptions } from 'sahne-js';

const target = 'http://localhost:8080';
const devTarget = 'http://localhost:5173';

const configs = [
	{
		match: `${target}/**`,
		proxy: devTarget,
		ignore: `${target}/api/**`
	}
];

/**
 * TODO:
 *  -> check if proxy file read works
 *  -> check if cookie override works
 *  -> check if header override works
 *  -> check if body override works
 *  -> check if fallback works
 */

describe('Sahne Proxy', () => {
	let browser;
	let page;

	// Before each test, launch the browser and create a new page
	beforeAll(async () => {
		browser = await puppeteer.launch({
			// TODO: remove those
			defaultViewport: null,
			headless: false
		});
		page = await browser.newPage();
		await page.setRequestInterception(true);
		page.on('request', (interceptedRequest) => {
			handleInterceptions(interceptedRequest, configs);
		});

		await page.goto('http://localhost:8080');
		await page.waitForResponse(
			(response) => response.url().includes('/api/todos') && response.status() === 200
		);
	});

	// After each test, close the browser
	afterAll(async () => {
		await browser.close();
	});

	it('should get title from dev server via proxy request', async () => {
		const content = await page.$eval('.sahne-title', (el) => el.textContent.trim());
		expect(content).toBe('This is update from SahneJS');
	});

	it('should NOT intercept api request', async () => {
		const todoCount = await page.$$eval('#todo-item', (items) => items.length);
		expect(todoCount).toBe(10);
	});
});
