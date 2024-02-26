import puppeteer from "puppeteer";
import fetch from "node-fetch";

/**
 * defines configuratiosn for the sahne runner
 * @param {import(".").SahneConfigs} options
 * @returns {import(".").SahneConfigs}
 */
export const defineSahneConfig = (options) => options;

const checkShouldProxied = (reqUrl, targetUrl) => {
  // INFO: optimistic check for perfornace reasons
  if (!reqUrl.startsWith(targetUrl)) return false;

  /**
   * INFO: Intercepted request URL with ports might return false positive
   * with above condition when targetUrl does not have a port.
   *
   * Example:
   * const targetUrl = "https://example.com"
   * const reqUrl = "https://example.com:3000"
   *
   * So we need to make sure that ports are matching.
   */
  const reqUrlInstance = new URL(reqUrl);
  const targetUrlInstance = new URL(targetUrl);
  if (reqUrlInstance.port !== targetUrlInstance.port) return false;

  return true;
};

/**
 *
 * @param {import(".").HTTPRequest} interceptedRequest
 * @param {import(".").Interceptor} interceptConfigs
 * @returns {Promise<void>}
 */
const handleRequest = async (
  interceptedRequest,
  {
    onRequest,
    proxyTarget,
    target,
    urlRewrite,
    overrides = {},
    ignoreRequest,
    ignoreRequestAfterProxyResponse,
  }
) => {
  if (onRequest) {
    await onRequest(interceptedRequest);
    if (interceptedRequest.isInterceptResolutionHandled()) return;
  }

  const requestUrlString = interceptedRequest.url();
  let shouldProxied = checkShouldProxied(requestUrlString, target);
  if (ignoreRequest) {
    shouldProxied = !ignoreRequest(interceptedRequest, !shouldProxied);
  }

  if (!shouldProxied) return;

  let proxyUrl = urlRewrite
    ? urlRewrite(requestUrlString, proxyTarget)
    : requestUrlString.replace(target, proxyTarget);
  let proxyRequestOptions = {
    method: interceptedRequest.method(),
    headers: interceptedRequest.headers(),
    body: interceptedRequest.postData(),
  };
  let proxyRequestFetchArgs = [proxyUrl, proxyRequestOptions];
  if (overrides.proxyRequestArgs) {
    overrides.proxyRequestArgs(proxyRequestParams, interceptedRequest);
  }

  try {
    const proxyResponse = await fetch(...proxyRequestFetchArgs);
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
        contentType: proxyResponse.headers.get("content-type"),
      };
      let proxyResponsePuppeteerArgs = [response];
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

    // interceptedRequest.continue();
  } catch (e) {
    
    console.log("Proxy request failure", e);
    interceptedRequest.continue();
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
  onRequest,
  proxyTarget,
  target,
  urlRewrite,
  overrides = {
    proxyRequestArgs: undefined,
    proxyResponseArgs: undefined,
  },
  ignoreRequest,
  ignoreRequestAfterProxyResponse,
  interceptors = [],
}) => {
  const browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false,
    ...puppeteerOptions.launch,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 0, height: 0 });
  await page.setRequestInterception(true);

  const firstConfig = {
    onRequest,
    target,
    proxyTarget,
    urlRewrite,
    overrides,
    ignoreRequest,
    ignoreRequestAfterProxyResponse,
  };
  const allConfigs = [firstConfig, ...interceptors];

  for (const config of allConfigs) {
    page.on("request", (interceptedRequest) => {
      if (interceptedRequest.isInterceptResolutionHandled()) return;
      handleRequest(interceptedRequest, config);
    });
  }

  await page.goto(initialUrl || target, puppeteerOptions.goto);
};

export default run;
