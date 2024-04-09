import type { RequestInit, Response } from 'node-fetch';
import type { HTTPRequest, PuppeteerLaunchOptions, ResponseForRequest } from 'puppeteer';
import type { GoToOptions } from 'puppeteer';

import type { URL } from 'url';

export type Match = string | RegExp | ((url: URL, request: HTTPRequest) => boolean);

export declare interface SahneConfig {
	/**
	 * The initial URL to navigate to.
	 * It must include protocol (eg. https://).
	 */
	initialUrl: string;
	/**
	 * Additional puppeteer options.
	 */
	puppeteerOptions?: {
		/**
		 * The options for Puppeteer's goto method.
		 */
		goto?: GoToOptions;
		/**
		 * The options for Puppeteer's launch method.
		 */
		launch?: Partial<PuppeteerLaunchOptions>;
	};
	/**
	 * The interceptor config to be used.
	 */
	interceptor?: Config | Config[];
}

export type RequestHeaders = ReturnType<HTTPRequest['headers']>;
export type RequestBody = ReturnType<HTTPRequest['postData']>;
export type RequestMethod = ReturnType<HTTPRequest['method']>;

/**
 * Defines configurationS for the sahne runner
 * @param {SahneConfig} configs
 * @returns {SahneConfig}
 */
export declare function defineConfig(config: SahneConfig): SahneConfig;

/**
 * Represents a function that overrides request headers.
 * @param {Record<string, string>} headers - The current set of request headers.
 * @param {OverrideRequestAdditionalParams} additionalParams - Additional parameters.
 * @returns {Record<string, string>} - The modified request headers.
 */
export type OverrideRequestHeadersFunction = (
	headers: Record<string, string>,
	additionalParams: OverrideRequestAdditionalParams
) => RequestInit['headers'];

/**
 * Represents a function that overrides request body.
 * @param {RequestBody} body - The current request body.
 * @param {OverrideRequestAdditionalParams} additionalParams - Additional parameters.
 * @returns {RequestBody} - The modified request body.
 */
export type OverrideRequestBodyFunction = (
	body: RequestBody,
	additionalParams: OverrideRequestAdditionalParams
) => RequestInit['body'];

export type RequestOptions = {
	method: RequestMethod;
	headers: Record<string, string>;
	body: RequestBody;
};

export type OverrideRequesOptionsFunction = (
	options: RequestOptions,
	additionalParams: OverrideRequestAdditionalParams
) => RequestInit;

export type OverrideRequestAdditionalParams = {
	proxyUrl: string;
	request: HTTPRequest;
};

export type ResponseRaw = Response;

export type OverrideResponseAdditionalParams = {
	responseRaw: ResponseRaw;
	response: ResponseForRequest;
	request: HTTPRequest;
};

export type OverrideResponseHeadersFunction = (
	headers: Record<string, string>,
	addtionalParams: OverrideResponseAdditionalParams
) => ResponseForRequest['headers'];

export type OverrideResponseBodyFunction = (
	body: Buffer,
	addtionalParams: OverrideResponseAdditionalParams
) => ResponseForRequest['body'];

export type OverrideResponseObject = {
	status: ResponseRaw['status'];
	headers: ReturnType<RequestBody['headers']['raw']>;
	body: Buffer;
	contentType: string;
};

export type OverrideResponseOptionsFunction = (
	options: OverrideResponseObject,
	addtionalParams: OverrideResponseAdditionalParams
) => ResponseForRequest;

export type Action = {
	abort: () => void;
	respond: (params: ResponseForRequest) => void;
	continue: () => void;
	fallback: () => void;
};

export type OnRequestParams = {
	/**
	 * The request object.
	 */
	request: HTTPRequest;
	/**
	 * The action object.
	 */
	action: Action;
	/**
	 * The route object.
	 */
	url: URL;
};

export type OnResponseParams = {
	/**
	 * The response object.
	 */
	response: ResponseForRequest;
	/**
	 * The response object.
	 */
	responseRaw: any;
	/**
	 * The action object.
	 */
	action: Action;
	/**
	 * The request object.
	 */
	request: HTTPRequest;
	/**
	 * The route object.
	 */
	url: URL;
};

export type ActionOnResponseParams = {
	/**
	 * The response object.
	 */
	response: ResponseForRequest;
	/**
	 * The response object.
	 */
	responseRaw: Response;
	/**
	 * The request object.
	 */
	request: HTTPRequest;
	/**
	 * The route object.
	 */
	url: URL;
};

/**
 * Configuration options for the Sahne package.
 */
export type Config = {
	/**
	 * A glob pattern, regex pattern or predicate receiving [URL] to match while
	 * routing. When a `baseURL` via the context options was provided and the
	 * passed URL is a path, it gets merged via the [`new
	 * URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL)
	 * constructor.
	 *
	 */
	match?: Match | Match[];
	/**
	 * A glob pattern, regex pattern or predicate receiving [URL] to match while
	 * routing. When a `baseURL` via the context options was provided and the
	 * passed URL is a path, it gets merged via the [`new
	 * URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL)
	 * constructor.
	 */
	ignore?: Match | Match[];
	/**
	 * The proxy URL where intercepted requests will be sent (proxied to).
	 * The path and query params will be mapped to the proxy target.
	 * The query params will be appended to the proxy URL.
	 *
	 * @example https://example.com/prefix
	 * @example https://example.com?param=value
	 */
	proxy?: string | Function;
	/**
	 * Rewrite the path before sending the request to the proxy target.
	 * @param {string} path - The original path of the request.
	 * @returns {string} - The rewritten path.
	 */
	pathRewrite?: (path: string) => string;
	/**
	 * Rewrite the URL before sending the request to the proxy target.
	 * @param {string} url - The original URL of the request.
	 * @returns {string} - The rewritten URL.
	 */
	urlRewrite?: (url: string) => string;
	/**
	 * The request method to be intercepted.
	 * @param {OnRequestParams} params - Params to be passed to the function.
	 * @param {Action} params.action - Avaliable actions that can be called.
	 * @param {Request} params.request - The intercepted request.
	 * @param {URL} params.url - The URL object of the intercepted request.
	 * @returns {void} - Returns void.
	 */
	onRequest?: (param: OnRequestParams) => void;
	abort?: Match | Match[];
	fallback?: Match | Match[];
	/**
	 * The response method to be intercepted.
	 * @param {OnResponseParams} params - Puppeteer's APIResponse instance.
	 * @param {OnResponseParams['action']} params.action - Avaliable actions that can be called.
	 * @param {OnResponseParams['response']} params.response - The intercepted response.
	 * @param {OnResponseParams['responseRaw']} params.responseRaw - The intercepted route.
	 * @param {OnResponseParams['response']} params.request - The intercepted request.
	 * @param {OnResponseParams['url']} params.url - The URL object of the intercepted request.
	 * @returns {void} - Returns void.
	 */
	onResponse?: (params: OnResponseParams) => void;
	/**
	 * Intercepted request ignored (not intercepted) if the function returns true.
	 * @param {ActionOnResponseParams} params params to be passed to the function
	 * @param {ActionOnResponseParams['response'] } params.response - Puppeteer's APIResponse instance.
	 * @param {ActionOnResponseParams['responseRaw']} params.responseRaw - The intercepted route.
	 * @param {ActionOnResponseParams['request']} params.request - The intercepted request.
	 * @param {ActionOnResponseParams['url']} params.url - The URL object of the intercepted request.
	 * @returns {boolean} - Returns true if the request should be intercepted, false otherwise.
	 */
	ignoreOnResponse?: (params: ActionOnResponseParams) => boolean;
	/**
	 * Intercepted response aborted if the function returns true.
	 * @param {ActionOnResponseParams} params params to be passed to the function
	 * @param {ActionOnResponseParams['response']} params.response - Puppeteer's APIResponse instance.
	 * @param {ActionOnResponseParams['responseRaw']} params.responseRaw - The intercepted route.
	 * @param {ActionOnResponseParams['request']} params.request - The intercepted request.
	 * @param {ActionOnResponseParams['url']} params.url - The URL object of the intercepted request.
	 * @returns {boolean} - Returns true if the request should be intercepted, false otherwise.
	 */
	abortOnResponse?: (params: ActionOnResponseParams) => boolean;
	/**
	 * Intercepted response fallbacks to next interception rule if the function returns true.
	 * @param {ActionOnResponseParams} params params to be passed to the function
	 * @param {ActionOnResponseParams['response']} params.response - Puppeteer's APIResponse instance.
	 * @param {ActionOnResponseParams['responseRaw']} params.responseRaw - The intercepted route.
	 * @param {ActionOnResponseParams['request']} params.request - The intercepted request.
	 * @param {ActionOnResponseParams['url']} params.url - The URL object of the intercepted request.
	 * @returns {boolean} - Returns true if the request should be intercepted, false otherwise.
	 */
	fallbackOnResponse?: (params: ActionOnResponseParams) => boolean;
	/**
	 * Overrirde request headers to be passed to fetch method of NodeFetch
	 */
	overrideRequestHeaders?: OverrideRequestHeadersFunction;
	/**
	 * Overrirde request headers to be passed to fetch method of NodeFetch
	 */
	overrideRequestBody?:
		| Partial<ReturnType<OverrideRequestBodyFunction>>
		| OverrideRequestBodyFunction;
	/**
	 * Overrirde request headers to be passed to Puppeteer's fetch method
	 */
	overrideRequestOptions?:
		| Partial<ReturnType<OverrideRequesOptionsFunction>>
		| OverrideRequesOptionsFunction;
	/**
	 * Overrirde response headers to be passed to Puppeteer's respond method
	 */
	overrideResponseHeaders?:
		| Partial<ReturnType<OverrideResponseHeadersFunction>>
		| OverrideResponseHeadersFunction;
	/**
	 * Overrirde response headers to be passed to Puppeteer's respond method
	 */
	overrideResponseBody?:
		| Partial<ReturnType<OverrideResponseBodyFunction>>
		| OverrideResponseBodyFunction;
	/**
	 * Overide response options of Puppeteer's respond method
	 */
	overrideResponseOptions?:
		| Partial<ReturnType<OverrideResponseOptionsFunction>>
		| OverrideResponseOptionsFunction;
};
