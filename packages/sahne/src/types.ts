import type { RequestInit, Response } from 'node-fetch';
import type {
	Browser,
	HTTPRequest,
	Page,
	PuppeteerLaunchOptions,
	ResponseForRequest
} from 'puppeteer';
import type { GoToOptions } from 'puppeteer';
import type { HandleProxyUrl } from './utils/types';

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
	interceptor?: InterceptorConfig | InterceptorConfig[];
	/**
	 * Callbacks to be called before and after the launch and goto methods of Puppeteer.
	 */
	callback?: {
		beforeLaunch?: () => void;
		afterLaunch?: (browser: Browser) => void;
		beforeGoto?: (browser: Browser, page: Page) => void;
		afterGoto?: (browser: Browser, page: Page) => void;
	};
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

export type ResponseFromProxyRequest = Response;

export type OverrideResponseAdditionalParams = {
	responseFromProxyRequest: ResponseFromProxyRequest;
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
	status: ResponseFromProxyRequest['status'];
	headers: Record<string, string>;
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
	ignore: () => void;
	next: () => void;
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
	 * The response object that is processed to be supplied for the Puppeteer's
	 * respond method.
	 */
	response: ResponseForRequest;
	/**
	 * The raw response object from the proxy request.
	 */
	responseFromProxyRequest?: Response;
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
	 * The response object that is processed to be supplied for the Puppeteer's
	 * respond method.
	 */
	response: ResponseForRequest;
	/**
	 * The raw response object from the proxy request.
	 */
	responseFromProxyRequest?: Response;
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
export type CommonConfig = {
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
	 * The request method to be intercepted.
	 * @param {OnRequestParams} params - Params to be passed to the function.
	 * @param {Action} params.action - Avaliable actions that can be called.
	 * @param {Request} params.request - The intercepted request.
	 * @param {URL} params.url - The URL object of the intercepted request.
	 * @returns {void} - Returns void.
	 */
	onRequest?: (param: OnRequestParams) => void;
	/**
	 * Intercepted request ignored (not intercepted) if the function returns true.
	 * It will not be handled by any other following rules unlike next.
	 */
	abort?: Match | Match[];
	/**
	 * Intercepted request will next to next rule if the function returns
	 * true and not be handled by the current one.
	 */
	next?: Match | Match[];
	/**
	 * The response method to be intercepted.
	 * @param {OnResponseParams} params - Puppeteer's APIResponse instance.
	 * @param {OnResponseParams['action']} params.action - Avaliable actions that can be called.
	 * @param {OnResponseParams['response']} params.response - The response to be provided for intercepted request.
	 * @param {OnResponseParams['responseFromProxyRequest']} params.responseFromProxyRequest - The response from the proxy request.
	 * @param {OnResponseParams['response']} params.request - The intercepted request.
	 * @param {OnResponseParams['url']} params.url - The URL object of the intercepted request.
	 * @returns {void} - Returns void.
	 */
	onResponse?: (params: OnResponseParams) => void;
	/**
	 * Intercepted request ignored (not intercepted) if the function returns true.
	 * @param {ActionOnResponseParams} params params to be passed to the function
	 * @param {ActionOnResponseParams['response'] } params.response - The response to be provided for intercepted request.
	 * @param {ActionOnResponseParams['responseFromProxyRequest']} params.responseFromProxyRequest - The response from the proxy request.
	 * @param {ActionOnResponseParams['request']} params.request - The intercepted request.
	 * @param {ActionOnResponseParams['url']} params.url - The URL object of the intercepted request.
	 * @returns {boolean} - Returns true if the request should be intercepted, false otherwise.
	 */
	ignoreOnResponse?: (params: ActionOnResponseParams) => boolean;
	/**
	 * Intercepted response aborted if the function returns true.
	 * @param {ActionOnResponseParams} params params to be passed to the function
	 * @param {ActionOnResponseParams['response']} params.response - The response to be provided for intercepted request.
	 * @param {ActionOnResponseParams['responseFromProxyRequest']} params.responseFromProxyRequest - The response from the proxy request.
	 * @param {ActionOnResponseParams['request']} params.request - The intercepted request.
	 * @param {ActionOnResponseParams['url']} params.url - The URL object of the intercepted request.
	 * @returns {boolean} - Returns true if the request should be intercepted, false otherwise.
	 */
	abortOnResponse?: (params: ActionOnResponseParams) => boolean;
	/**
	 * Intercepted response nexts to next interception rule if the function returns true.
	 * @param {ActionOnResponseParams} params params to be passed to the function
	 * @param {ActionOnResponseParams['response']} params.response - The response to be provided for intercepted request.
	 * @param {ActionOnResponseParams['responseFromProxyRequest']} params.responseFromProxyRequest - The response from the proxy request.
	 * @param {ActionOnResponseParams['request']} params.request - The intercepted request.
	 * @param {ActionOnResponseParams['url']} params.url - The URL object of the intercepted request.
	 * @returns {boolean} - Returns true if the request should be intercepted, false otherwise.
	 */
	nextOnResponse?: (params: ActionOnResponseParams) => boolean;
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
	/**
	 * The function to be called when the request handling fails.
	 * @param {Error} error - The error object.
	 * @param {Object} params - Params to be passed to the function.
	 * @param {HTTPRequest} params.request - The intercepted request.
	 * @param {Action} params.action - Avaliable actions that can be called.
	 * @param {URL} params.url - The URL object of the intercepted request.
	 * @returns {void}
	 */
	onError?: (
		error: unknown,
		params: {
			request: HTTPRequest;
			action: Action;
			url: URL;
		}
	) => void | ResponseForRequest;
};

export type FileConfig = {
	/**
	 * The file path to be used as the response body.
	 */
	file: string | ((requestUrl: string, request: HTTPRequest) => string);
};

export type ProxyConfig = {
	/**
	 * The proxy URL where intercepted requests will be sent (proxied to).
	 * The path and query params will be mapped to the proxy target.
	 * The query params will be appended to the proxy URL.
	 *
	 * @example https://example.com/prefix
	 * @example https://example.com?param=value
	 */
	proxy?: string | ((requestUrl: string, request: HTTPRequest) => string);
	/**
	 * Rewrite the path before sending the request to the proxy target.
	 * @param {string} path - The original path of the request.
	 * @returns {string} - The rewritten path.
	 */
	pathRewrite?: (path: string, request: HTTPRequest) => string;
	/**
	 * Rewrite the URL before sending the request to the proxy target.
	 * @param {string} url - The original URL of the request.
	 * @returns {string} - The rewritten URL.
	 */
	urlRewrite?: (url: string, request: HTTPRequest) => string;
	/**
	 * Overrirde request headers to be passed to fetch method of NodeFetch
	 */
	overrideRequestHeaders?:
		| Partial<ReturnType<OverrideRequestHeadersFunction>>
		| OverrideRequestHeadersFunction;
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
};

type AllPropsNever<T> = {
	[P in keyof T]?: never;
};

export type ConfigForProxy = CommonConfig & AllPropsNever<FileConfig> & ProxyConfig;

export type ConfigForFile = CommonConfig & AllPropsNever<ProxyConfig> & FileConfig;

export type InterceptorConfig = ConfigForProxy | ConfigForFile;

export type ProcessedInterceptorConfig = InterceptorConfig & {
	handlers: { handleProxyUrl: HandleProxyUrl };
};

export type TransferObject = {
	puppeteer: HTTPRequest;
};
