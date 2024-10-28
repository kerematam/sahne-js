import puppeteer, { HTTPRequest } from 'puppeteer';
import { InterceptorConfig, SahneConfig, ProcessedInterceptorConfig } from './types';
import {
	makeHandleProxy,
	handleResponse,
	handleRequestConfig,
	handleRequest,
	handleOnError
} from './utils';
import { setDefaultResultOrder } from 'node:dns';
import Request from './Request';
import type { Page as PageType, HTTPRequest as HTTPRequestType } from 'puppeteer';

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
		next,
		abort,

		onResponse,
		ignoreOnResponse,
		nextOnResponse,
		abortOnResponse,

		overrideRequestBody,
		overrideRequestHeaders,
		overrideRequestOptions,

		overrideResponseHeaders,
		overrideResponseBody,
		overrideResponseOptions,

		onError,
		handlers
	} = config;

	const request = new Request(interceptedRequest);
	const isRequestHandled = await handleRequestConfig({
		request,
		match,
		ignore,
		onRequest,
		next,
		abort
	});

	if (isRequestHandled) return;

	const { response, responseFromProxyRequest, error } = await handleRequest({
		request,
		file,
		pathRewrite,
		overrideRequestOptions,
		overrideRequestBody,
		overrideRequestHeaders,
		urlRewrite,
		handlers
	});

	let responseFromOnError;
	if (error || !response) {
		responseFromOnError = await handleOnError({ request, error, onError });
		if (responseFromOnError) return;
		if (!request.isRequestHandled) request.next();
		return;
	}

	await handleResponse({
		request,
		response: responseFromOnError || response,
		responseFromProxyRequest,
		onResponse,
		overrideResponseHeaders,
		overrideResponseBody,
		overrideResponseOptions,
		ignoreOnResponse,
		nextOnResponse,
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

		// INFO: no interception occurs if request is not handled
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

	const interceptor = config !== undefined ? new Interceptor(config) : null;
	const setupInterception = async (page: PageType) => {
		await page.setViewport({ width: 0, height: 0 });
		await page.setRequestInterception(true);
		if (interceptor) {
			page.on('request', (interceptedRequest: HTTPRequestType) => {
				interceptor.handleRequest(interceptedRequest);
			});
		}
	};

	browser.on('targetcreated', async (target) => {
		const newPage = await target.page();
		if (newPage) {
			await setupInterception(newPage);
		}
	});

	const [initialPage] = await browser.pages();
	await setupInterception(initialPage);

	await callback.beforeGoto?.(browser, initialPage);
	await initialPage.goto(initialUrl, puppeteerOptions.goto);
	await callback.afterGoto?.(browser, initialPage);
};
