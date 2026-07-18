# SahneJS

SahneJs is a CLI tool designed for mocking, testing, and debugging by intercepting and manipulating requests. It leverages Puppeteer's interceptor to capture and manipulate specific requests. You can direct these requests to an internal development server or read them from a local file.

[Documentation](https://sahne-js-docs.kerem-atam.chatgpt.site) · [Getting started](https://sahne-js-docs.kerem-atam.chatgpt.site/guide/getting-started) · [Configuration reference](https://sahne-js-docs.kerem-atam.chatgpt.site/reference/configuration)

## Use Cases

- Run your local single-page application on a production domain
- Debug issues in production
- Verify your solution without deployment

https://github.com/user-attachments/assets/11c2f84b-3f4e-4f1e-8134-83ecd9fd2ca4

## Installation

SahneJS v2 is ESM-only and requires Node.js 22.18 or newer. Install SahneJS and its Puppeteer peer dependency:

```sh
# Puppeteer is a peer dependency
npm install --save-dev puppeteer sahne-js
```

## Quick Start (Mock an Endpoint)

Create a `sahne.config.ts` file:

```ts
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

Run the tool with the following command:

```sh
npx sahne
```

By default, an interactive run requests access to Chrome remote debugging. Open
`chrome://inspect/#remote-debugging` and enable it first, or run
`npx sahne --browser=launch` for an isolated browser.

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

Create a `sahne.config.ts` file:

```ts
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

```ts
// vite.config.ts: https://vite.dev/config/
export default defineConfig({
  // ...
  server: {
    strictPort: true,
    ws: {
      protocol: 'ws',
      host: 'localhost',
      clientPort: 5173
    }
  }
});
```

## Override Request and Response

```ts
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
      overrideRequestHeaders: (headers) => ({
        ...headers,
        'x-sahne': 'true',
        cookie: 'sahne=true'
      }),

      // Override response
      overrideResponseBody: (body) => body,
      overrideResponseHeaders: (headers) => headers
    }
  ]
});
```

## Multiple Rules

```ts
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

```ts
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

## Browser Modes and Existing Chrome

Sahne defaults to `browser.mode: 'auto'`: an interactive terminal uses Chrome
remote debugging, while CI and non-interactive environments launch an isolated
browser. The other explicit modes are `remote-debugging` and `launch`.

Enable remote debugging at `chrome://inspect/#remote-debugging`, then run Sahne
normally or require that mode explicitly:

```sh
sahne --browser=remote-debugging
```

Equivalent configuration:

```ts
export default defineConfig({
  initialUrl: 'http://localhost:4173',
  browser: {
    mode: 'remote-debugging',
    indicator: 'title'
  },
  interceptor: {
    match: 'http://localhost:4173/**',
    proxy: 'http://localhost:5173'
  }
});
```

The default channel is Chrome stable. Puppeteer reads Chrome's
`DevToolsActivePort`, so no fixed port is required and Sahne does not probe
`127.0.0.1:9222`. Chrome then asks the developer to approve the connection. The
approval wait defaults to 60 seconds and can be changed with
`browser.remoteDebuggingTimeout`.

Remote-debugging mode requires Puppeteer `24.32.0` or newer. On older supported
Puppeteer releases, `auto` warns and launches an isolated browser; explicit
`remote-debugging` mode fails instead of silently changing modes.

Sahne creates one fresh managed tab, intercepts only that tab, prefixes its
title with `🟢 Sahne — `, and leaves existing and subsequently opened personal
tabs alone. Cleanup closes the managed tab and disconnects without closing
Chrome. Set `browser.indicator: 'none'` to preserve an exact application title,
or `browser.closeManagedPageOnExit: false` to retain the tab with its title
restored.

Closing the managed tab manually ends Sahne's connected session and disconnects
its client without closing Chrome.

`browser.dangerouslyEnableForAllTabs: true` is the explicit opt-in for applying
interception to every existing and future tab in a connected browser. It prints
a warning because authenticated and sensitive pages also pass through Sahne's
request machinery. Sahne still never navigates, marks, or closes those personal
tabs.

Mode precedence is CLI `--browser`, `SAHNE_BROWSER_MODE`, `browser.mode`, then
`auto`. Existing raw `puppeteerOptions.connect` and `puppeteerOptions.launch`
configs remain supported. Use raw `connect.browserURL` for an intentional
classic endpoint such as `http://127.0.0.1:9222`.

## Using Without CLI

You may import `Interceptor` directly and use it within your existing Puppeteer code.

```ts
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
npx sahne --file sahne.config.my-site.ts

# Alternatively
npx sahne -f sahne.config.my-site.ts
```

## Process Lifecycle

The CLI owns and closes a Puppeteer browser it launches. In
`remote-debugging` mode or with raw `puppeteerOptions.connect`, it closes only
its managed tab by default, disconnects its client, and leaves externally owned
Chrome running. Closing the browser, pressing Ctrl+C, or sending SIGTERM removes
request listeners and interrupts in-flight handlers before the process exits.
Missing, invalid, or unloadable configuration files are reported on stderr and
exit with status 1.
