// @ts-check
import puppeteer from 'puppeteer';

import {
	makeHandleProxy,
	handleResponse,
	handleRequestConfig,
	handleRequest
} from './utils/index.mjs';

/**
 * defines configurations for the sahne runner
 * @param {import(".").SahneConfig} options
 * @returns {import(".").SahneConfig}
 */
export const defineConfig = (options) => options;

/**
 * Request handler
 * @param {import("puppeteer").HTTPRequest} interceptedRequest
 * @param {import(".").Interceptor} config
 * @returns {Promise<void>}
 */
const handleInterception = async (interceptedRequest, config, handlers) => {
	const {
		match,
		ignore,
		file,

		urlRewrite,
		pathRewrite,

		onRequest,
		fallback,
		abort,

		onResponse,
		ignoreOnResponse,
		fallbackOnResponse,
		abortOnResponse,

		overrideRequestBody,
		overrideRequestHeaders,
		overrideRequestOptions,

		overrideResponseHeaders,
		overrideResponseBody,
		overrideResponseOptions,

		onProxyFail,
		onFileReadFail
	} = config;

	let isRequestHandled = await handleRequestConfig({
		interceptedRequest,
		match,
		ignore,
		onRequest,
		fallback,
		abort
	});
	if (isRequestHandled) return;

	const { response, responseRaw } = await handleRequest({
		file,
		pathRewrite,
		overrideRequestOptions,
		overrideRequestBody,
		overrideRequestHeaders,
		interceptedRequest,
		urlRewrite,
		handlers,
		onProxyFail,
		onFileReadFail
	});

	await handleResponse({
		interceptedRequest,
		response,
		responseRaw,
		onResponse,
		overrideResponseHeaders,
		overrideResponseBody,
		overrideResponseOptions,
		ignoreOnResponse,
		fallbackOnResponse,
		abortOnResponse
	});
};

/**
 * Handles all the interceptors
 * @param {import("puppeteer").HTTPRequest} interceptedRequest
 * @param {(import(".").Interceptor | undefined)[]} allConfigs
 * @returns {Promise<void>}
 */
const handleInterceptions = async (interceptedRequest, allConfigs) => {
	for (const config of allConfigs) {
		if (config === undefined) return;
		if (interceptedRequest.isInterceptResolutionHandled()) break;

		const handleProxyUrl = makeHandleProxy({ proxy: config.proxy, interceptedRequest });
		const handlers = { handleProxyUrl };
		await handleInterception(interceptedRequest, config, handlers);
	}

	// INFO: Fallback if not handled
	if (!interceptedRequest.isInterceptResolutionHandled()) {
		await interceptedRequest.continue();
	}
};

/** *
 * @param {import(".").SahneConfig} options
 * @returns {Promise<void>} - A promise that resolves when the script finishes running.
 */
const run = async ({
	initialUrl,
	puppeteerOptions = {
		goto: {},
		launch: {}
	},
	interceptor
}) => {
	const browser = await puppeteer.launch({
		defaultViewport: null,
		headless: false,
		...puppeteerOptions.launch
	});

	const [page] = await browser.pages();
	await page.setViewport({ width: 0, height: 0 });
	await page.setRequestInterception(true);

	const allConfigs = Array.isArray(interceptor) ? interceptor : [interceptor];

	page.on('request', (interceptedRequest) => {
		handleInterceptions(interceptedRequest, allConfigs);
	});

	await page.goto(initialUrl, puppeteerOptions.goto);
};

export default run;
