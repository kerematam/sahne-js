import puppeteer from "puppeteer";
import fetch from "node-fetch";

/**
 * @typedef {import('"puppeteer/lib/types.d.ts').PuppeteerLaunchOptions"} PuppeteerLaunchOptions
 */

/**
 * Runs the puppeteer script with the provided options.
 *
 * @param {Object} options - The options for running the script.
 * @param {string} options.initialUrl - The initial URL to navigate to.
 * @param {string} options.proxyTarget - The source origin for intercepting requests.
 * @param {string} options.target - The target origin for intercepting requests.
 * @param {Function} [options.urlRewrite] - The function for rewriting URLs.
 * @param {Object} [options.puppeteerOptions] - The options for puppeteer.
 * @param {Object} [options.puppeteerOptions.goto] - The options for puppeteer's goto method.
 * @param {PuppeteerLaunchOptions} [options.puppeteerOptions.launch] - The options for puppeteer's launch method.
 * @param {Function} [options.onRequest] - The function to run when a request is intercepted.
 * @param {Object} [options.overrides] - The overrides for the request and response handling.
 * @param {Function} [options.overrides.proxyRequestFetchArgs] - The function to override the proxy request fetch arguments.
 * @param {Function} [options.overrides.proxyResponsePuppeteerArgs] - The function to override the proxy response puppeteer arguments.
 * @returns {Promise<void>} - A promise that resolves when the script finishes running.
 */
const run = async ({
  initialUrl,
  proxyTarget,
  target,
  urlRewrite,
  onRequest,
  overrides = {
    proxyRequestFetchArgs: undefined,
    proxyResponsePuppeteerArgs: undefined,
  },
  puppeteerOptions = {
    goto: {},
    launch: {},
  },
}) => {
  const browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false,
    ...puppeteerOptions.launch,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 0, height: 0 });
  await page.setRequestInterception(true);

  page.on("request", async (interceptedRequest) => {
    if (onRequest) {
      await onRequest(interceptedRequest);
      if (interceptedRequest.isInterceptResolutionHandled()) return;
    }

    const requestUrlString = interceptedRequest.url();
    const shouldProxied = requestUrlString.startsWith(target);
    if (!shouldProxied) {
      interceptedRequest.continue();
      return;
    }

    try {
      let proxyUrl;
      if (urlRewrite) {
        proxyUrl = urlRewrite(requestUrlString, proxyTarget);
      } else {
        proxyUrl = requestUrlString.replace(target, proxyTarget);
      }

      let proxyRequestOptions = {
        method: interceptedRequest.method(),
        headers: interceptedRequest.headers(),
        body: interceptedRequest.postData(),
      };
      let proxyRequestFetchArgs = [proxyUrl, proxyRequestOptions];
      if (overrides.proxyRequesFetchArgs) {
        overrideProxyRequestArgs(proxyRequestParams, interceptedRequest);
      }
      const proxyResponse = await fetch(...proxyRequestFetchArgs);
      const responseBody = await proxyResponse.arrayBuffer();
      const responseHeaders = proxyResponse.headers.raw();

      if (
        proxyResponse.status === 200 ||
        proxyResponse.ok ||
        proxyResponse.status === 304
      ) {
        let response = {
          status: proxyResponse.status,
          headers: responseHeaders,
          body: Buffer.from(responseBody),
          contentType: proxyResponse.headers.get("content-type"),
        };
        let proxyResponsePuppeteerArgs = [response];
        if (overrides.proxyResponsePuppeteerArgs) {
          overrideProxyResponsePuppeteerArgs(
            proxyResponsePuppeteerArgs,
            interceptedRequest,
            proxyResponse
          );
        }

        await interceptedRequest.respond(...proxyResponsePuppeteerArgs);

        return;
      }

      interceptedRequest.continue();
    } catch (e) {
      interceptedRequest.continue();
    }
  });

  await page.goto(initialUrl || target, puppeteerOptions.goto);
};

export default run;
