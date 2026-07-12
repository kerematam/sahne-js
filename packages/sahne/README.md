# SahneJS

SahneJs is a CLI tool designed for mocking, testing, and debugging by intercepting and manipulating requests. It leverages Puppeteer's interceptor to capture and manipulate specific requests. You can direct these requests to an internal development server or read them from a local file.

## Use Cases

- Run your local single-page application on a production domain
- Debug issues in production
- Verify your solution without deployment

https://github.com/kerematam/sahne-js/assets/5495509/1f6dd509-6feb-4730-9603-6e6ee6161a5b

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

## Browser Modes

Sahne has three high-level browser modes:

| Mode               | Interactive terminal                    | CI or non-interactive environment |
| ------------------ | --------------------------------------- | --------------------------------- |
| `auto`             | Connect through Chrome remote debugging | Launch an isolated browser        |
| `remote-debugging` | Require Chrome remote debugging         | Require Chrome remote debugging   |
| `launch`           | Launch an isolated browser              | Launch an isolated browser        |

`auto` is the default when the config does not contain raw
`puppeteerOptions.connect` or `puppeteerOptions.launch` options. A rejected or
failed interactive remote-debugging request does not silently launch another
browser. Use `launch` explicitly when isolation is preferred.

Configure a mode in `sahne.config.ts`:

```ts
export default defineConfig({
  initialUrl: 'http://localhost:4173',
  browser: {
    mode: 'auto'
  }
});
```

The CLI and environment variable override the config:

```sh
sahne --browser=auto
sahne --browser=remote-debugging
sahne --browser=launch

SAHNE_BROWSER_MODE=launch sahne
```

Precedence is CLI, `SAHNE_BROWSER_MODE`, config, then the `auto` default. Raw
Puppeteer launch and connect configs remain supported for advanced and
backward-compatible workflows.

## Connect to Existing Chrome with Remote Debugging

For Chrome 144+'s permission-based debugging flow, enable remote debugging at
`chrome://inspect/#remote-debugging`, then use `remote-debugging` mode:

```ts
export default defineConfig({
  initialUrl: 'http://localhost:4173',
  browser: {
    mode: 'remote-debugging'
  }
});
```

The default channel is Chrome stable. Select another installed channel when
needed:

```ts
export default defineConfig({
  initialUrl: 'http://localhost:4173',
  browser: {
    mode: 'remote-debugging',
    channel: 'chrome-beta'
  }
});
```

Sahne delegates discovery to `puppeteer.connect({ channel: 'chrome' })`.
Puppeteer reads Chrome's `DevToolsActivePort`, so no fixed port is required and
Sahne does not probe `127.0.0.1:9222`. Chrome asks the developer to approve the
connection. Remote-debugging mode requires Puppeteer `24.32.0` or newer and is
currently validated with Puppeteer `25.3.0`.

With an older supported Puppeteer release, `auto` prints a warning and launches
an isolated browser instead. Explicit `remote-debugging` mode fails with an
upgrade instruction; it never silently changes modes.

When Sahne connects, it leaves existing tabs alone and creates one fresh
managed tab. Interception is installed before that tab navigates to
`initialUrl`, and its title is prefixed with `🟢 Sahne — ` so it is easy to
recognize in Chrome and Chrome DevTools MCP. Sahne brings the managed tab to the
front and closes only that tab on cleanup.

Closing the managed tab manually also ends Sahne's connected session and
disconnects its Puppeteer client.

Connected-browser behavior can be adjusted separately:

```ts
export default defineConfig({
  initialUrl: 'http://localhost:4173',
  browser: {
    mode: 'remote-debugging',
    // Wait up to 60 seconds for discovery and Chrome approval.
    remoteDebuggingTimeout: 60_000,
    // Use "none" when the application asserts document.title exactly.
    indicator: 'title',
    // Set false to retain the managed tab after Sahne disconnects.
    closeManagedPageOnExit: true
  },
  interceptor: {
    match: 'http://localhost:4173/**',
    proxy: 'http://localhost:5173'
  }
});
```

If the timeout expires, Sahne fails with setup guidance and disconnects any
late Puppeteer connection instead of leaving an attached client behind.

If a specialized workflow intentionally needs every tab to pass through
Sahne's request interception, use the deliberately explicit escape hatch:

```ts
export default defineConfig({
  initialUrl: 'http://localhost:4173',
  browser: {
    mode: 'remote-debugging',
    dangerouslyEnableForAllTabs: true
  }
});
```

This affects existing and subsequently created tabs, including authenticated
and sensitive pages. Sahne prints a warning, but still never navigates,
title-marks, or closes those personal tabs. Match and ignore rules decide which
requests are transformed; all requests are paused briefly by Puppeteer's
interception machinery.

For a classic CDP discovery endpoint, continue using raw Puppeteer options:

```ts
export default defineConfig({
  initialUrl: 'http://localhost:4173',
  puppeteerOptions: {
    connect: {
      browserURL: 'http://127.0.0.1:9222'
    }
  }
});
```

Only `browserURL` requires `/json/version`. A known WebSocket URL can be passed
as `browserWSEndpoint`. Raw `connect` and `launch` remain mutually exclusive.
On cleanup, Sahne disconnects from an externally owned browser; it closes a
browser that it launched.

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
its managed tab by default, disconnects its client, and leaves the externally
owned browser running.

Closing the browser, pressing Ctrl+C, or sending SIGTERM removes request
listeners and interrupts in-flight handlers before the process exits. Missing,
invalid, or unloadable configuration files are reported on stderr and exit with
status 1.
