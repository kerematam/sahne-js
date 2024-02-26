import puppeteer from "puppeteer";
import { fetch } from "node-fetch-native";

function getProxiedUrl(originalUrl, proxy) {
  const urlObj = new URL(originalUrl);
  const pathWithQuery = urlObj.pathname + urlObj.search;

  return `${proxy}${pathWithQuery}`;
}

function mapHeadersToObject(map) {
  let object = {};
  for (let [key, value] of map.entries()) {
    object[key] = value;
  }

  return object;
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
    // args: ["--disable-web-security", "--ignore-certificate-errors"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 0, height: 0 });
  await page.setRequestInterception(true);

  page.on("request", async (interceptedRequest) => {
    if (interceptor.preHandling) {
      await interceptor.preHandling(interceptedRequest);

      if (interceptedRequest.isInterceptResolutionHandled()) {
        console.log("isInterceptResolutionHandled");
        return;
      }
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
      const responseHeaders = mapHeadersToObject(proxyResponse.headers);

      if (proxyResponse.status !== 200) {
        interceptedRequest.continue();
        return;
      }

      await interceptedRequest.respond({
        status: proxyResponse.status,
        headers: responseHeaders,
        body: Buffer.from(responseBody),
      });
    } catch (e) {
      interceptedRequest.continue();
    }
  });

  await page.goto(initialUrl || targetOrigin, puppeteerOptions.goto);
};

export default run;
