// @ts-check
import puppeteer from 'puppeteer';
import fetch from 'node-fetch';

import {
	makeHandleProxy,
	handlePathRewrite,
	handleUrlRewrite,
	handleResponse,
	handleOverrideRequest,
	getResponse,
	handleRequestConfig
} from './utils/index.mjs';

/**
 * defines configuratiosn for the sahne runner
 * @param {import(".").SahneConfig} options
 * @returns {import(".").SahneConfig}
 */
export const defineConfig = (options) => options;

const handleProxyUrl = ({
	requestUrl,
	handleProxyUrl,
	pathRewrite,
	urlRewrite,
	interceptedRequest
}) => {
	interceptedRequest.url();
	let proxyUrl = handleProxyUrl(requestUrl);
	proxyUrl = handleUrlRewrite({ urlRewrite, proxyUrl, interceptedRequest });
	proxyUrl = handlePathRewrite({ pathRewrite, proxyUrl, interceptedRequest });

	return proxyUrl;
};

/**
 * Request handler
 * @param {import("puppeteer").HTTPRequest} interceptedRequest
 * @param {import(".").Config} config
 * @returns {Promise<void>}
 */
const handleRequest = async (interceptedRequest, config, handlers) => {
	const {
		match,
		ignore,

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
		overrideResponseOptions
	} = config;

	const isRequestHandled = await handleRequestConfig({
		match,
		ignore,
		interceptedRequest,
		onRequest,
		fallback,
		abort
	});
	if (isRequestHandled) return;

	const proxyUrl = handleProxyUrl({
		requestUrl: interceptedRequest.url(),
		handleProxyUrl: handlers.handleProxyUrl,
		pathRewrite,
		urlRewrite,
		interceptedRequest
	});
	const requestOptions = handleOverrideRequest({
		overrideRequestOptions,
		overrideRequestBody,
		overrideRequestHeaders,
		interceptedRequest,
		proxyUrl
	});

	let responseRaw;
	try {
		responseRaw = await fetch(proxyUrl, requestOptions);
	} catch (e) {
		// TODO: handleRequestFail
		// handleRequestFail({ onRequestFail, error, interceptedRequest });
		return;
	}

	const response = await getResponse(responseRaw);

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
			const handleProxyUrl = makeHandleProxy({ proxy: config.proxy, interceptedRequest });
			const handlers = { handleProxyUrl };
			await handleRequest(interceptedRequest, config, handlers);
		}

		// INFO: Fallback if not handled
		if (!interceptedRequest.isInterceptResolutionHandled()) {
			await interceptedRequest.continue();
		}
	});

	await page.goto(initialUrl, puppeteerOptions.goto);
};

export default run;
