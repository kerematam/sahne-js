import puppeteer, { HTTPRequest } from 'puppeteer';
import { Interceptor, SahneConfig } from './types';
import {
	makeHandleProxy,
	handleResponse,
	handleRequestConfig,
	handleRequest
} from './utils/index.mjs';

const handleInterception = async (
	interceptedRequest: HTTPRequest,
	config: Interceptor,
	handlers: any
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

const handleInterceptions = async (
	interceptedRequest: HTTPRequest,
	allConfigs: (Interceptor | undefined)[]
): Promise<void> => {
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

export const run = async ({
	initialUrl,
	puppeteerOptions = {
		goto: {},
		launch: {}
	},
	interceptor
}: SahneConfig): Promise<void> => {
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
