// @ts-check
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
 * Request handler
 * @param {import("puppeteer").HTTPRequest} interceptedRequest
 * @param {import(".").Interceptor} interceptConfigs
 * @returns {Promise<void>}
 */
const handleRequest = async (
  interceptedRequest,
  {
    onRequest,
    // TODO change to function | string
    proxyTarget = "",
    // TODO: matchTarget
    // TODO change to function | string
    target = "",
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
    ? urlRewrite(requestUrlString)
    : requestUrlString.replace(target, proxyTarget);

  let proxyRequestOptions = {
    method: interceptedRequest.method(),
    headers: interceptedRequest.headers(),
    body: interceptedRequest.postData(),
  };
  /**
   * @type {import(".").NodeFetchArgs}
   */
  let proxyRequestFetchArgs = [proxyUrl, proxyRequestOptions];
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
      const proxyResponsePuppeteerArgs = [response, 1];
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
