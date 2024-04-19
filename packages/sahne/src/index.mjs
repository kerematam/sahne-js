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
		proxy,

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
		abort,
		file
	});
	if (isRequestHandled) return;

	const { response, responseRaw } = await handleRequest({
		file,
		proxy,
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

	page.on('request', async (interceptedRequest) => {
		for (const config of allConfigs) {
			if (config === undefined) return;
			if (interceptedRequest.isInterceptResolutionHandled()) break;

			const handlers = {
				handleProxyUrl: config.proxy
					? makeHandleProxy({ proxy: config.proxy, interceptedRequest })
					: undefined
			};
			await handleInterception(interceptedRequest, config, handlers);
		}

		// INFO: Fallback if not handled
		if (!interceptedRequest.isInterceptResolutionHandled()) {
			await interceptedRequest.continue();
		}
	});

	await page.goto(initialUrl, puppeteerOptions.goto);
};

export default run;
