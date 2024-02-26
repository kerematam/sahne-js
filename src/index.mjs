// @ts-check
import puppeteer from "puppeteer";
import fetch from "node-fetch";

/**
 * defines configuratiosn for the sahne runner
 * @param {import(".").SahneConfigs} options
 * @returns {import(".").SahneConfigs}
 */
export const defineSahneConfig = (options) => options;


/**
 * @param {import("puppeteer").HTTPRequest} interceptedRequest 
 * @param {string | import(".").MatchTargetFunction} matchTarget 
 * @returns {boolean}
 */
const checkIsMatched = (interceptedRequest, matchTarget) => {
  const requestUrlString = interceptedRequest.url();

  if (typeof matchTarget === "function") {
    return matchTarget(requestUrlString, interceptedRequest);
  }

  // INFO: optimistic check for perfornace reasons
  if (!requestUrlString.startsWith(matchTarget)) return false;

  /**
   * INFO: Intercepted request URL with port might return false positive
   * with above condition when matchTarget does not have a port.
   *
   * Example:
   * const matchTarget = "https://example.com"
   * const requestUrl = "https://example.com:3000"
   *
   * So we need to make sure that ports are matching.
   */
  const requestUrlInstance = new URL(requestUrlString);
  const targetUrlInstance = new URL(matchTarget);
  if (requestUrlInstance.port !== targetUrlInstance.port) return false;

  return true;
};

/**
 * @param {import("puppeteer").HTTPRequest} interceptedRequest 
 * @param {string | import(".").ProxyTargetFunction} proxyTarget 
 * @returns 
 */
const getProxyTargetUrl = (interceptedRequest, proxyTarget) => {
  const requestUrlString = interceptedRequest.url();
  if (typeof proxyTarget === "function") {
    return proxyTarget(requestUrlString, interceptedRequest);
  }

  if (typeof proxyTarget === "string") {
    const requestOrigin = new URL(interceptedRequest.url()).origin;
    let proxyTargetUrl = requestUrlString.replace(requestOrigin, proxyTarget);

    return proxyTargetUrl;
  }

  throw new Error("Invalid proxyTarget configuration,");
};

/**
 * Request handler
 * @param {import("puppeteer").HTTPRequest} interceptedRequest
 * @param {import(".").Interceptor} interceptConfigs
 * @returns {Promise<void>}
 */
const handleRequest = async (
  interceptedRequest,
  {
    onRequest,
    matchTarget,
    proxyTarget,
    overrides = {},
    ignoreRequest,
    ignoreRequestAfterProxyResponse,
  }
) => {
  if (onRequest) {
    await onRequest(interceptedRequest);
    if (interceptedRequest.isInterceptResolutionHandled()) return;
  }

  // if (
  //   typeof matchTarget === "function" &&
  //   !matchTarget(interceptedRequest.url(), interceptedRequest)
  // ) {
  //   return;
  // }

  const isMatched = checkIsMatched(interceptedRequest, matchTarget);
  if (!isMatched) return;
  if (ignoreRequest && ignoreRequest(interceptedRequest)) return;

  const proxyTargetUrl = getProxyTargetUrl(interceptedRequest, proxyTarget);

  let proxyRequestOptions = {
    method: interceptedRequest.method(),
    headers: interceptedRequest.headers(),
    body: interceptedRequest.postData(),
  };
  /**
   * @type {import(".").NodeFetchArgs}
   */
  let proxyRequestFetchArgs = [proxyTargetUrl, proxyRequestOptions];
  if (overrides.proxyRequestArgs) {
    overrides.proxyRequestArgs(proxyRequestFetchArgs, interceptedRequest);
  }

  let proxyResponse;
  try {
    proxyResponse = await fetch(...proxyRequestFetchArgs);
    const responseBody = await proxyResponse.arrayBuffer();
    const responseHeaders = proxyResponse.headers.raw();

    const internalRespondCondition = proxyResponse.status !== 404;
    const respondCondition = ignoreRequestAfterProxyResponse
      ? !ignoreRequestAfterProxyResponse(
          proxyResponse,
          interceptedRequest,
          !internalRespondCondition
        )
      : internalRespondCondition;

    if (respondCondition) {
      let response = {
        status: proxyResponse.status,
        headers: responseHeaders,
        body: Buffer.from(responseBody),
        contentType: proxyResponse.headers.get("content-type") || "",
      };

      /**
       * @type {import(".").PuppeteerRespondArgs}
       */
      const proxyResponsePuppeteerArgs = [response, undefined];
      if (overrides.proxyResponseArgs) {
        overrides.proxyResponseArgs(
          proxyResponsePuppeteerArgs,
          interceptedRequest,
          proxyResponse
        );
      }
      await interceptedRequest.respond(...proxyResponsePuppeteerArgs);

      return;
    }
  } catch (e) {
    console.log("e", e);
  }
};

/** *
 * @param {import(".").SahneConfigs} options
 * @returns {Promise<void>} - A promise that resolves when the script finishes running.
 */
const run = async ({
  initialUrl,
  puppeteerOptions = {
    goto: {},
    launch: {},
  },
  interceptor,
}) => {
  const browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false,
    ...puppeteerOptions.launch,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 0, height: 0 });
  await page.setRequestInterception(true);

  const allConfigs = Array.isArray(interceptor) ? interceptor : [interceptor];

  page.on("request", async (interceptedRequest) => {
    for (const config of allConfigs) {
      if (interceptedRequest.isInterceptResolutionHandled()) return;
      await handleRequest(interceptedRequest, config);
    }

    if (!interceptedRequest.isInterceptResolutionHandled()) {
      interceptedRequest.continue();
    }
  });

  await page.goto(initialUrl, puppeteerOptions.goto);
};

export default run;
