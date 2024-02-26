import type { RequestInfo } from "node-fetch";
import type { RequestInit, Response } from "node-fetch";
import type {
  HTTPRequest,
  ResponseForRequest,
  PuppeteerLaunchOptions,
} from "puppeteer";
import type { GoToOptions } from "puppeteer";

export type NodeFetchFirstArg = URL | RequestInfo;
export type NodeFetchArgs = [NodeFetchFirstArg, RequestInit];
export type ProxyRequestOverrideArgs = (
  args: NodeFetchArgs,
  interceptedRequest: HTTPRequest
) => void;

/**
 * {@link HTTPRequest.respond}
 */
export type PuppeteerRespondArgs = [
  response: Partial<ResponseForRequest>,
  priority?: number
];

export type ProxyResponseOverrideArgs = (
  args: PuppeteerRespondArgs,
  interceptedRequest: HTTPRequest,
  nodeFetchResponse: Response
) => void;

export type onRequest = (request: HTTPRequest) => void;

export type UrlRewrite = (url: string) => string;

export declare type SahneConfigs = {
  /**
   * The initial URL to navigate to.
   * It must include protocol (eg. https://).
   * @default {SahneConfigs.target}
   */
  initialUrl: string;
  /**
   * The proxy target where intercepted requests will be sent (proxied to).
   * It must include protocol (eg. https://).
   * It can have port and path but it should not have query params.
   * @example https://example.com
   * @example https://example.com:8080
   * @example https://example.com/path/to/intercept
   */
  proxyTarget: string;
  /**
   * URL to the target where requests will be intercepted. 
   * It must include protocol (eg. https).
   * It can have port and path but it should not have query params.
   * @example https://example.com
   * @example https://example.com:8080
   * @example https://example.com/path/to/intercept
   */
  target: string;
  /**
   * The function for rewriting URLs.
   */
  urlRewrite?: UrlRewrite;
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
   * Puppeteer's onRequest function.
   */
  onRequest?: (request: HTTPRequest) => void;
  /**
   * The overrides for the request and response handling.
   */
  overrides?: {
    proxyRequestArgs?: ProxyRequestOverrideArgs;
    proxyResponseArgs?: ProxyResponseOverrideArgs;
  };
  /**
   * The function for ignoring requests to be intercepted
   * @param request intercepted request
   * @param ignoreRequest internally evaluated ignore decision
   * @returns {boolean}
   */
  ignoreRequest: (request: HTTPRequest, ignoreRequest: boolean) => boolean;
  /**
   * The function for ignoring requests to be intercepted after proxy response
   * @param proxyResponse node-fetch proxy response
   * @param interceptedRequest puppeteer intercepted request
   * @param ignoreRequest internally evaluated ignore decision, happens when request return with status code 404.
   * @returns {boolean}
   */
  ignoreRequestAfterProxyResponse: (
    proxyResponse: Response,
    interceptedRequest: HTTPRequest,
    ignoreRequest: boolean
  ) => boolean;
};

/**
 * Defines configuratiosn for the sahne runner
 * @param {SahneConfigs} configs
 * @returns {SahneConfigs}
 */
export declare function defineSahneConfig(config: SahneConfigs): SahneConfigs;
