import puppeteer from "puppeteer";
import fetch from "node-fetch";

/**
 * @typedef {import('"puppeteer/lib/types.d.ts').PuppeteerLaunchOptions"} PuppeteerLaunchOptions
 */

function getProxiedUrl(originalUrl, proxy) {
  const urlObj = new URL(originalUrl);
  const pathWithQuery = urlObj.pathname + urlObj.search;

  return `${proxy}${pathWithQuery}`;
}

/**
 * Runs the puppeteer script with the provided options.
 *
 * @param {Object} options - The options for running the script.
 * @param {string} options.initialUrl - The initial URL to navigate to.
 * @param {string} options.proxyTarget - The source origin for intercepting requests.
 * @param {string} options.target - The target origin for intercepting requests.
 * @param {Object} [options.interceptor] - The interceptor object for handling requests.
 * @param {Object} [options.puppeteerOptions] - The options for puppeteer.
 * @param {Object} [options.puppeteerOptions.goto] - The options for puppeteer's goto method.
 * @param {PuppeteerLaunchOptions} [options.puppeteerOptions.launch] - The options for puppeteer's launch method.
 * @returns {Promise<void>} - A promise that resolves when the script finishes running.
 */
const run = async ({
  initialUrl,
  proxyTarget,
  target,
  interceptor = {},
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
    if (interceptor.preHandling) {
      await interceptor.preHandling(interceptedRequest);
      if (interceptedRequest.isInterceptResolutionHandled()) return;
    }

    const url = interceptedRequest.url();
    const parsedTargetUrl = new URL(url);
    if (parsedTargetUrl.origin !== target) {
      interceptedRequest.continue();
      return;
    }

    try {
      const proxyUrl = getProxiedUrl(interceptedRequest.url(), proxyTarget);
      const proxyResponse = await fetch(proxyUrl, {
        method: interceptedRequest.method(),
        headers: interceptedRequest.headers(),
        body: interceptedRequest.postData(),
      });
      const responseBody = await proxyResponse.arrayBuffer();
      const responseHeaders = proxyResponse.headers.raw();

      // TODO: study here
      if (
        proxyResponse.status === 200 ||
        proxyResponse.ok ||
        proxyResponse.status === 304
      ) {
        await interceptedRequest.respond({
          status: proxyResponse.status,
          headers: responseHeaders,
          body: Buffer.from(responseBody),
        });

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
