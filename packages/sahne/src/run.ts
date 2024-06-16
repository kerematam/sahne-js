import puppeteer, { HTTPRequest } from 'puppeteer';
import { InterceptorConfig, SahneConfig, ProcessedInterceptorConfig } from './types';
import { makeHandleProxy, handleResponse, handleRequestConfig, handleRequest } from './utils';
import { setDefaultResultOrder } from 'node:dns';

// CAVEAT: This is fix for the following issue:
// - https://github.com/node-fetch/node-fetch/issues/1624
// - https://stackoverflow.com/questions/72390154/econnrefused-when-making-a-request-to-localhost-using-fetch-in-node-js
setDefaultResultOrder('ipv4first');

export const handleInterception = async (
	interceptedRequest: HTTPRequest,
	config: ProcessedInterceptorConfig
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
		onFileReadFail,
		handlers
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

export class Interceptor {
	#configs: ProcessedInterceptorConfig[] = [];

	constructor(configs: InterceptorConfig | InterceptorConfig[]) {
		const allConfigs = this.#preProcessConfigs(configs);
		this.#configs = allConfigs;
	}

	#preProcessConfigs = (
		configs?: InterceptorConfig | InterceptorConfig[]
	): ProcessedInterceptorConfig[] => {
		if (configs === undefined) return [];
		let allConfigs = Array.isArray(configs) ? configs : [configs];

		return allConfigs.map((config) => ({
			...config,
			handlers: { handleProxyUrl: makeHandleProxy({ proxy: config.proxy }) }
		}));
	};

	handleRequest = async (interceptedRequest: HTTPRequest): Promise<void> => {
		for (const config of this.#configs) {
			if (config === undefined) return;
			if (interceptedRequest.isInterceptResolutionHandled()) break;

			await handleInterception(interceptedRequest, config);
		}

		// INFO: Fallback if not handled
		if (!interceptedRequest.isInterceptResolutionHandled()) {
			await interceptedRequest.continue();
		}
	};
}

export const run = async ({
	initialUrl,
	puppeteerOptions = {
		goto: {},
		launch: {}
	},
	interceptor: config,
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

	if (config !== undefined) {
		const interceptor = new Interceptor(config);
		page.on('request', (interceptedRequest) => {
			interceptor.handleRequest(interceptedRequest);
		});
	}

	await callback.beforeGoto?.(browser, page);
	await page.goto(initialUrl, puppeteerOptions.goto);
	await callback.afterGoto?.(browser, page);
};
