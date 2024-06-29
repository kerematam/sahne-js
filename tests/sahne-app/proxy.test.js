// @ts-check
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer from 'puppeteer';
import { Interceptor } from 'sahne-js';
import sahneConfig from './sahne.config.api';

const interceptorConfig = sahneConfig.interceptor || {};

/**
 * - define interception rule in tests/sahne-app/sahne.config.api.js
 * - define server implementation in tests/vite-dev-app/server/
 * - define the way to make request and expected results in
 *   tests/vite-dev-app/src/request.js
 */
const requests = {
	'/api/todos': '/api/todos',
	'/api/read/me/from/a/file': '/api/read/me/from/a/file',
	'/api/require-x-sahne-header': '/api/require-x-sahne-header',
	'/redirect-to-another-api': '/redirect-to-another-api'
};

describe('Sahne Proxy', () => {
	let browser;
	let page;

	beforeAll(async () => {
		browser = await puppeteer.launch({
			headless: true
		});
		page = await browser.pages().then((pages) => pages[0]);
		await page.setRequestInterception(true);
		const interceptor = new Interceptor(interceptorConfig);
		page.on('request', (interceptedRequest) => {
			interceptor.handleRequest(interceptedRequest);
		});

		await page.goto('http://localhost:8080');

		await page.waitForRequest((request) => {
			const paths = Object.values(requests);
			const requestPath = new URL(request.url()).pathname;
			return paths.includes(requestPath);
		});
	});

	afterAll(async () => {
		await browser.close();
	});

	it('should get title from dev server via proxy request', async () => {
		const content = await page.$eval('.sahne-title', (el) => el.textContent.trim());
		expect(content).toBe('This is update from SahneJS');
	});

	it('should NOT intercept api request', async () => {
		const api = requests['/api/todos'];
		const selector = '#' + api.replace(/\//g, '\\/');
		const content = await page.$eval(selector, (el) => el.textContent.trim());
		expect(content).toBe('Success');
	});

	it('should read from a file', async () => {
		const api = requests['/api/read/me/from/a/file'];
		const selector = '#' + api.replace(/\//g, '\\/');
		const content = await page.$eval(selector, (el) => el.textContent.trim());
		expect(content).toBe('Success');
	});

	it('should override request headers and cookie', async () => {
		const api = requests['/api/require-x-sahne-header'];
		const selector = '#' + api.replace(/\//g, '\\/');
		const content = await page.$eval(selector, (el) => el.textContent.trim());
		expect(content).toBe('Success');
	});

	it('should handle redirect API', async () => {
		const api = requests['/redirect-to-another-api'];
		const selector = '#' + api.replace(/\//g, '\\/');
		const content = await page.$eval(selector, (el) => el.textContent.trim());
		expect(content).toBe('Success');
	});
});
