# SahneJS

SahneJs is a CLI tool that can be used for mocking, testing, and debugging by intercepting and manipulating desired requests. It uses Puppeteer's interceptor to catch specific requests for manipulation. You can direct these requests to an internal development server from any URL, or read them from a local file you specify.

https://github.com/kerematam/sahne-js/assets/5495509/1f6dd509-6feb-4730-9603-6e6ee6161a5b

## Installation

To install `SahneJS`, run the following command:

```sh
# Puppeteer is peer dependency
npm install --save-dev puppeteer sahne-js
```

## Quick Start (Mock an Endpoint)

Create a `sahne.config.js`:

```js
import { defineConfig } from 'sahne-js';

export default defineConfig({
  // Initial URL to visit on load
  initialUrl: 'http://my-target-domain.com',
  interceptor: [
    {
      // Define matching rule for interception. 
      // You may also pass a function or define multiple rule with an array
      match: '/api/path-to-my-endpoint',
      // Only match our origin
      ignore: ({ host }) => host !== 'my-target-domain.com',
      // Read the response body from mock.json
      file: './mock.json'
    }
  ]
});
```

For CommonJs:

```js
const { defineConfig } = require('sahne-js');

module.exports = defineConfig({
  // Initial URL to visit on load
  initialUrl: 'http://my-target-domain.com',
  interceptor: [
    {
      // Define matching rule for interception. 
      // You may also pass a function or define multiple rule with an array
      match: '/api/path-to-my-endpoint',
      // Only match our origin
      ignore: ({ host }) => host !== 'my-target-domain.com',
      // Read the response body from mock.json
      file: './mock.json'
    }
  ]
});
```
You may trigger the tool with below command:

```sh
npx sahne
```

You may add to the scripts in `package.json` to run with `npm run sahne`:

```patch
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
+ "sahne": "sahne",
  "test": " vitest"
},
```

## Use it with React Vite App (SPA)

Replace the production bundle with local development one.

Create a `sahne.config.js`:

```js
// sahne.config.js, lets you easy access to types
import { defineConfig } from 'sahne-js';

export default defineConfig({
  // Initial URL to visit on load
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

You may trigger the tool with below command. Ensure that proxy server is running:

```sh
# Initilize the tool:
# Caveat(!): Your dev server (proxyURL) should be running
npx sahne
```

To be able to use with HMR in Vite, you need to expose HMR socket seperately to escape target domain:

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

      // override request
      overrideRequestBody: (body) => body,
      overrideRequestHeaders: (headers) => ({ ...headers, 'x-sahne': 'true', cookie: 'sahne=true' })

      // override response
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
      // matched request are ignored and WON'T be forwarded to next rules.
      ignore: ({ origin }) => origin !== target
    },
    {
      match: () => true,
      proxy: devTarget,
      // matched requests are immadiately forwarded to next rules to be handled
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

You may pass desired configs to launch and also access to browser and page with callback hooks:

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
      // do stuff with browser or page
    },
    afterLaunch: async (browser, page) => {
      // do stuff with browser or page
    },
    beforeGoto: async (browser, page) => {
      // do stuff with browser or page
    },
    afterGoto: async (browser, page) => {
      // do stuff with browser or page
    }
  }
});
```

## Using Without CLI

You may import `Interceptor` directly and use it inside your existing Puppeteer code.

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

# alternatively
npx sahne -f sahne.config.my-site.js
```
