
# SahneJS

SahneJs is a CLI tool designed for mocking, testing, and debugging by intercepting and manipulating requests. It leverages Puppeteer's interceptor to capture and manipulate specific requests. You can direct these requests to an internal development server or read them from a local file.

## Use Cases
- Run your local single-page application on a production domain
- Debug issues in production
- Verify your solution without deployment

https://github.com/kerematam/sahne-js/assets/5495509/1f6dd509-6feb-4730-9603-6e6ee6161a5b

## Installation

To install `SahneJS`, run the following command:

```sh
# Puppeteer is a peer dependency
npm install --save-dev puppeteer sahne-js
```

## Quick Start (Mock an Endpoint)

Create a `sahne.config.js` file:

```js
import { defineConfig } from 'sahne-js';

export default defineConfig({
  // Initial URL to visit on load
  initialUrl: 'http://my-target-domain.com',
  interceptor: [
    {
      // Define matching rule for interception. 
      // You may also pass a function or define multiple rules with an array.
      // It supports regex and glob patterns as well.
      match: '/api/path-to-my-endpoint',
      // Only matches with our origin.
      ignore: ({ host }) => host !== 'my-target-domain.com',
      // Read the response body from mock.json.
      file: './mock.json'
    }
  ]
});
```

For CommonJS:

```js
const { defineConfig } = require('sahne-js');

module.exports = defineConfig({
  initialUrl: 'http://my-target-domain.com',
  interceptor: [
    {
      match: '/api/path-to-my-endpoint',
      ignore: ({ host }) => host !== 'my-target-domain.com',
      file: './mock.json'
    }
  ]
});
```

Run the tool with the following command:

```sh
npx sahne
```

Add it to the scripts in `package.json` to run with `npm run sahne`:

```patch
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
+ "sahne": "sahne",
  "test": "vitest"
}
```

## Use with a React Vite App (SPA)

Replace the production bundle with a local development one.

Create a `sahne.config.js` file:

```js
// use defineConfig() for easy access to types
import { defineConfig } from 'sahne-js';

export default defineConfig({
  initialUrl: 'https://your-prod-site.com/home-page',
  interceptor: [
    {
      match: ({ href }) => href.startsWith('https://your-prod-site.com'),
      proxy: 'http://localhost:5173',
      ignore: 'https://your-prod-site.com/api/**'
    }
  ]
});
```

Run the tool with the following command. Ensure the proxy server is running:

```sh
# Initialize the tool:
# Note: Your dev server (proxyURL) should be running
npx sahne
```

To use it with HMR in Vite, you need to expose the HMR socket separately to escape the target domain:

```js
// vite.config.js: https://vitejs.dev/config/
export default defineConfig({
  // ...
  server: {
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      clientPort: 5173
    }
  }
});
```

## Use with Create React App

Same steps with Vite except HMR socket configuration should be:

```sh
# in .env
WDS_SOCKET_HOST=127.0.0.1
```


## Override Request and Response

```js
import { defineConfig } from 'sahne-js';

export default defineConfig({
  // Initial URL to visit on load
  initialUrl: 'http://my-target-domain.com',
  interceptor: [
    {
      match: '/api/path-to-my-endpoint',
      ignore: ({ host }) => host !== 'my-target-domain.com',
      proxy: 'http://localhost:5173',

      // Override request
      overrideRequestBody: (body) => body,
      overrideRequestHeaders: (headers) => ({ ...headers, 'x-sahne': 'true', cookie: 'sahne=true' }),

      // Override response
      overrideResponseBody: (body) => body,
      overrideResponseHeaders: (headers) => headers
    }
  ]
});
```

## Multiple Rules

```js
import { defineConfig } from 'sahne-js';

const target = 'http://localhost:8080';
const devTarget = 'http://localhost:5173';

export default defineConfig({
  initialUrl: target,
  interceptor: [
    {
      // Matched requests are ignored and WON'T be forwarded to the next rules.
      ignore: ({ origin }) => origin !== target
    },
    {
      match: () => true,
      proxy: devTarget,
      // Matched requests are immediately forwarded to the next rules to be handled.
      next: `/api/**`,
      ignore: `/redirect-to-another-api`
    },
    {
      match: `/api/read/me/from/a/file`,
      file: './mock.json'
    },
    {
      match: [`/api/require-x-sahne-header`, `/api/another-api`],
      overrideRequestHeaders: (headers) => ({ ...headers, 'x-sahne': 'true', cookie: 'sahne=true' })
    }
  ]
});
```

## Set Puppeteer Options

You may pass desired configs to launch and also access the browser and page with callback hooks:

```js
export default defineConfig({
  initialUrl: target,
  puppeteerOptions: {
    launch: {
      args: ['--incognito']
    }
  },
  callback: {
    beforeLaunch: async (browser, page) => {
      // Perform actions with browser or page
    },
    afterLaunch: async (browser, page) => {
      // Perform actions with browser or page
    },
    beforeGoto: async (browser, page) => {
      // Perform actions with browser or page
    },
    afterGoto: async (browser, page) => {
      // Perform actions with browser or page
    }
  }
});
```

## Using Without CLI

You may import `Interceptor` directly and use it within your existing Puppeteer code.

```js
import puppeteer from 'puppeteer';
import { Interceptor } from 'sahne-js';

const config = [
  {
    match: ({ href }) => href.startsWith('https://your-prod-site.com'),
    proxy: 'http://localhost:5173',
    ignore: 'https://your-prod-site.com/api/**'
  }
];

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.pages().then((pages) => pages[0]);
  await page.setRequestInterception(true);

  const interceptor = new Interceptor(config);
  page.on('request', (interceptedRequest) => {
    interceptor.handleRequest(interceptedRequest);
  });

  await page.goto('https://your-prod-site.com');
})();
```

## Custom Config File

```bash
npx sahne --file sahne.config.my-site.js

# Alternatively
npx sahne -f sahne.config.my-site.js
```
