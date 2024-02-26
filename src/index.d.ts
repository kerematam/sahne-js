import type { RequestInfo } from "node-fetch";
import type { RequestInit, Response } from "node-fetch";
import type {
  ResponseForRequest,
  PuppeteerLaunchOptions,
  HTTPRequest,
} from "puppeteer";
import type { GoToOptions } from "puppeteer";

export type NodeFetchFirstArg = URL | RequestInfo;
export type NodeFetchArgs = [NodeFetchFirstArg, RequestInit];

export type PuppeteerRespondArgs = [
  response: ResponseForRequest,
  priority?: number | undefined
];

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
  proxyTarget?: string;
  /**
   * URL to the target where requests will be intercepted.
   * It must include protocol (eg. https).
   * It can have port and path but it should not have query params.
   * @example https://example.com
   * @example https://example.com:8080
   * @example https://example.com/path/to/intercept
   */
  target?: string;
  /**
   * Function to rewrite the URL before sending the request to the proxy target.
   * @param {string} requestUrl - The intercepted request URL.
   * @returns {string} proxyTargetUrl - The rewritten URL to be sent to the proxy target.
   */
  urlRewrite?: (requestUrl: string) => string;
  /**
   * Intercept and handle directly with Puppeteer's request API.
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
    proxyRequestArgs?: (
      args: NodeFetchArgs,
      interceptedRequest: HTTPRequest
    ) => void;
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
  ignoreRequest?: (request: HTTPRequest, isRequestIgnored: boolean) => boolean;
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
