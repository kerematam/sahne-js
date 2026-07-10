import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { Interceptor } from 'sahne-js';
import sahneConfig from './sahne.config.api';

const interceptorConfig = sahneConfig.interceptor ?? [];

const requests = {
	'/api/todos': '/api/todos',
	'/api/read/me/from/a/file': '/api/read/me/from/a/file',
	'/api/require-x-sahne-header': '/api/require-x-sahne-header',
	'/redirect-to-another-api': '/redirect-to-another-api'
};

describe('Sahne Proxy', () => {
	let browser: Browser | undefined;
	let page: Page;

	beforeAll(async () => {
		browser = await puppeteer.launch({ headless: true });
		[page] = await browser.pages();
		await page.setRequestInterception(true);

		const interceptor = new Interceptor(interceptorConfig);
		page.on('request', (interceptedRequest) => {
			void interceptor.handleRequest(interceptedRequest);
		});

		await page.goto('http://localhost:8080');
		await page.waitForRequest((request) => {
			const requestPath = new URL(request.url()).pathname;
			return Object.values(requests).includes(requestPath);
		});
	});

	afterAll(async () => {
		await browser?.close();
	});

	const readText = (selector: string) =>
		page.$eval(selector, (element) => element.textContent?.trim() ?? '');

	it('should get title from dev server via proxy request', async () => {
		await expect(readText('.sahne-title')).resolves.toBe('This is update from SahneJS');
	});

	it('should NOT intercept api request', async () => {
		const selector = '#' + requests['/api/todos'].replace(/\//g, '\\/');
		await expect(readText(selector)).resolves.toBe('Success');
	});

	it('should read from a file', async () => {
		const selector = '#' + requests['/api/read/me/from/a/file'].replace(/\//g, '\\/');
		await expect(readText(selector)).resolves.toBe('Success');
	});

	it('should override request headers and cookie', async () => {
		const selector = '#' + requests['/api/require-x-sahne-header'].replace(/\//g, '\\/');
		await expect(readText(selector)).resolves.toBe('Success');
	});

	it('should handle redirect API', async () => {
		const selector = '#' + requests['/redirect-to-another-api'].replace(/\//g, '\\/');
		await expect(readText(selector)).resolves.toBe('Success');
	});
});
