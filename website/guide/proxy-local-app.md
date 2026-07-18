---
title: Proxy a local app
description: Serve a local Vite application inside a deployed site's URL and browser context.
---

# Proxy a local app

A common Sahne workflow replaces a deployed frontend bundle with the output of a local development server while keeping backend and third-party requests unchanged.

## Start the target and local servers

This example assumes:

- The deployed or preview application is available at `https://app.example.com`.
- Vite is running locally at `http://localhost:5173`.
- Requests under `/api/` should still reach the deployed backend.

Start Vite before Sahne:

```sh
npm run dev
```

## Configure Sahne

Create `sahne.config.ts` beside your project package file:

```ts
import { defineConfig } from 'sahne-js';

const target = 'https://app.example.com';

export default defineConfig({
  initialUrl: `${target}/dashboard`,
  interceptor: {
    match: `${target}/**`,
    ignore: `${target}/api/**`,
    proxy: 'http://localhost:5173'
  }
});
```

`ignore` runs before `match`, so API requests continue directly to the target. Other requests under the target origin are fetched from Vite and returned to the browser.

The visible page still has the target origin. Cookies, storage, navigation, and same-origin checks therefore behave in that context rather than under `localhost`.

## Configure Vite HMR

The page is not running under Vite's origin, so expose the hot-module replacement WebSocket explicitly:

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    ws: {
      protocol: 'ws',
      host: 'localhost',
      clientPort: 5173
    }
  }
});
```

Using a strict port prevents the HTTP server and HMR client from silently disagreeing after a port collision.

## Run the workflow

Use an isolated browser for a clean session:

```sh
npx sahne --browser=launch
```

Or run `npx sahne` in an interactive terminal to use an approved Chrome remote-debugging session. See [Browser modes](./browser-modes.md).

## Proxy URL behavior

Given a request for `https://app.example.com/assets/main.ts?theme=dark` and a proxy of `http://localhost:5173`, Sahne fetches:

```text
http://localhost:5173/assets/main.ts?theme=dark
```

The target host, protocol, and port are replaced. The original path and query remain. A path in the proxy URL is used as a prefix:

```ts
proxy: 'http://localhost:5173/preview';
```

The same request becomes:

```text
http://localhost:5173/preview/assets/main.ts?theme=dark
```

For more control, use [URL rewrites](./rewrite-and-override.md#rewrite-the-proxy-destination).

## Narrow the rule when possible

A broad frontend rule is convenient, but a narrower rule makes failures easier to understand. If the application emits all compiled assets under known paths, match only those paths:

```ts
interceptor: [
  { match: `${target}/assets/**`, proxy: 'http://localhost:5173' },
  { match: `${target}/src/**`, proxy: 'http://localhost:5173' },
  { match: `${target}/@vite/**`, proxy: 'http://localhost:5173' }
];
```

Keep the broad rule when the local HTML shell and client-side fallback must also come from Vite.
