import puppeteer, { HTTPRequest } from 'puppeteer';
import { Interceptor, SahneConfig } from './types';
import { makeHandleProxy, handleResponse, handleRequestConfig, handleRequest } from './utils';
import { setDefaultResultOrder } from 'node:dns';
import { HandleProxyUrl } from './utils/types';

// CAVEAT: This is fix for the following issue:
// - https://github.com/node-fetch/node-fetch/issues/1624
// - https://stackoverflow.com/questions/72390154/econnrefused-when-making-a-request-to-localhost-using-fetch-in-node-js
setDefaultResultOrder('ipv4first');

export const handleInterception = async (
	interceptedRequest: HTTPRequest,
	config: Interceptor,
	handlers: { handleProxyUrl: HandleProxyUrl }
): Promise<void> => {
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

	const isRequestHandled = await handleRequestConfig({
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

export const handleInterceptions = async (
	interceptedRequest: HTTPRequest,
	allConfigs: (Interceptor | undefined)[]
): Promise<void> => {
	for (const config of allConfigs) {
		if (config === undefined) return;
		if (interceptedRequest.isInterceptResolutionHandled()) break;

		// TODO: rise this, and call this once with singleton instance
		const handleProxyUrl = makeHandleProxy({ proxy: config.proxy, interceptedRequest });
		const handlers = { handleProxyUrl };
		await handleInterception(interceptedRequest, config, handlers);
	}

	// INFO: Fallback if not handled
	if (!interceptedRequest.isInterceptResolutionHandled()) {
		await interceptedRequest.continue();
	}
};

export const run = async ({
	initialUrl,
	puppeteerOptions = {
		goto: {},
		launch: {}
	},
	interceptor,
	callback = {}
}: SahneConfig): Promise<void> => {
	await callback.beforeLaunch?.();
	const browser = await puppeteer.launch({
		defaultViewport: null,
		headless: false,
		...puppeteerOptions.launch
	});
	await callback.afterLaunch?.(browser);

	const [page] = await browser.pages();
	await page.setViewport({ width: 0, height: 0 });
	await page.setRequestInterception(true);

	const allConfigs = Array.isArray(interceptor) ? interceptor : [interceptor];

	// const handleInceptions = new Interceptors();

	page.on('request', (interceptedRequest) => {
		handleInterceptions(interceptedRequest, allConfigs);
	});

	await callback.beforeGoto?.(browser, page);
	await page.goto(initialUrl, puppeteerOptions.goto);
	await callback.afterGoto?.(browser, page);
};
