import puppeteer from "puppeteer";
import fetch from "node-fetch";

function getProxiedUrl(originalUrl, proxy) {
  const urlObj = new URL(originalUrl);
  const pathWithQuery = urlObj.pathname + urlObj.search;

  return `${proxy}${pathWithQuery}`;
}

const run = async ({
  initialUrl,
  sourceOrigin,
  targetOrigin,
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
    if (parsedTargetUrl.origin !== targetOrigin) {
      interceptedRequest.continue();
      return;
    }

    try {
      const proxyUrl = getProxiedUrl(interceptedRequest.url(), sourceOrigin);
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

  await page.goto(initialUrl || targetOrigin, puppeteerOptions.goto);
};

export default run;
