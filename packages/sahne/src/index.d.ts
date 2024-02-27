import type { RequestInfo } from 'node-fetch';
import type { RequestInit, Response } from 'node-fetch';
import type { HTTPRequest, PuppeteerLaunchOptions, ResponseForRequest } from 'puppeteer';
import type { GoToOptions } from 'puppeteer';

export type NodeFetchFirstArg = URL | RequestInfo;

export type NodeFetchArgs = [
	NodeFetchFirstArg,
	// TODO: re-think overriding approach here
	Omit<RequestInit, 'body' | 'headers' | 'method'> & {
		body: string | undefined;
		headers: Record<string, string>;
		method: string;
	}
];

export type PuppeteerRespondArgs = [response: ResponseForRequest, priority?: number | undefined];

/**
 * Function that determines whether a request should be intercepted or not.
 * @param {string} url - The URL of the intercepted request.
 * @param {HTTPRequest} request - The intercepted request.
 * @returns {boolean} - Returns true if the request should be intercepted, false otherwise.
 */
export declare function MatchTargetFunction(url: string, request: HTTPRequest): boolean;

/**
 * Function that determines the proxy target URL for the intercepted request.
 * @param {string} url - The URL of the intercepted request.
 * @param {HTTPRequest} request - The intercepted request (from Puppeteer).
 */
export declare function ProxyTargetFunction(url: string, request: HTTPRequest): string;

/**
 * Represents an interceptor configuration.
 */
export interface Interceptor {
	/**
	 * The proxy target where intercepted requests will be sent (proxied to).
	 * It must include protocol (eg. https://).
	 * It can have port and path but it should not have query params.
	 * @example https://example.com
	 * @example https://example.com:8080
	 * @example https://example.com/path/to/intercept
	 */
	proxyTarget?: string | ProxyTargetFunction;
	/**
	 * URL to the target where requests will be intercepted.
	 * It must include protocol (eg. https).
	 * It can have port and path but it should not have query params.
	 * @example https://example.com
	 * @example https://example.com:8080
	 * @example https://example.com/path/to/intercept
	 */
	matchTarget?: string | MatchTargetFunction;
	/**
	 * Function to rewrite the URL before sending the request to the proxy target.
	 * @param {string} requestUrl - The intercepted request URL.
	 * @returns {string} proxyTargetUrl - The rewritten URL to be sent to the proxy target.
	 */
	urlRewrite?: (requestUrl: string) => string;
	/**
	 * Intercept and handle directly with Puppeteer's request API. This is called
	 * before handling of any other rules.
	 * @link https://pptr.dev/guides/request-interception
	 *
	 * @param {HTTPRequest} intercepted - Puppeteer's Request instance
	 * @returns {void}
	 */
	onRequest?: (request: HTTPRequest) => void;
	/**
	 * The overrides for the request and response handling.
	 */
	overrides?: {
		/**
		 * Override proxy request arguments to be supplied to node-fetch's fetch method.
		 * @param {NodeFetchArgs} args
		 * @param {HTTPRequest} interceptedRequest
		 * @returns {void}
		 */
		proxyRequestArgs?: (args: NodeFetchArgs, interceptedRequest: HTTPRequest) => void;
		/**
		 * Override proxy response arguments to be supplied to Puppeteer's respond method.
		 *
		 * @param {PuppeteerRespondArgs} args - puppeteer response arguments
		 * @param {HTTPRequest} interceptedRequest - puppeteer intercepted request
		 * @param {Response} nodeFetchResponse - node-fetch response
		 * @returns {void}
		 *
		 * @example
		 * proxyResponseArgs([response]) {
		 *   response.headers["X-Intercepted-By"] = "sahne";
		 * }
		 */
		proxyResponseArgs?: (
			args: PuppeteerRespondArgs,
			interceptedRequest: HTTPRequest,
			nodeFetchResponse: Response
		) => void;
	};
	/**
	 * The function for ignoring requests to be intercepted.
	 * @param {HTTPRequest} request - The intercepted request.
	 * @param {boolean} isRequestIgnored - Internally evaluated ignore decision.
	 * @returns {boolean}
	 */
	ignoreRequest?: (request: HTTPRequest) => boolean;
	/**
	 * The function for ignoring requests to be intercepted after proxy response.
	 * @param {Response} proxyResponse - The node-fetch proxy response.
	 * @param {HTTPRequest} interceptedRequest - The puppeteer intercepted request.
	 * @param {boolean} isRequestIgnored - Internally evaluated ignore decision, happens when request returns with status code 404.
	 * @returns {boolean}
	 */
	ignoreRequestAfterProxyResponse?: (
		proxyResponse: Response,
		interceptedRequest: HTTPRequest,
		isRequestIgnored: boolean
	) => boolean;
}

export declare interface SahneConfigs {
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
		goto?: Partial<GoToOptions>;
		/**
		 * The options for Puppeteer's launch method.
		 */
		launch?: Partial<PuppeteerLaunchOptions>;
	};
	/**
	 * The interceptors to be used for the Sahne instance.
	 */
	interceptor: Interceptor | Interceptor[];
}

/**
 * Defines configuratiosn for the sahne runner
 * @param {SahneConfigs} configs
 * @returns {SahneConfigs}
 */
export declare function defineSahneConfig(config: SahneConfigs): SahneConfigs;
