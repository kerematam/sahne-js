---
title: Getting started
description: Install SahneJS and intercept your first request with a local JSON response.
---

# Getting started

This walkthrough replaces one endpoint with a local JSON file. All other requests continue to their original destinations.

## Prerequisites

- Node.js 22.18 or newer
- Chrome or Chromium through the Puppeteer package
- A page with an HTTP or HTTPS URL that you are allowed to test

SahneJS v2 is ESM-only. Puppeteer is a peer dependency so your project controls the browser version.

## Install the packages

::: code-group

```sh [npm]
npm install --save-dev sahne-js puppeteer
```

```sh [pnpm]
pnpm add --save-dev sahne-js puppeteer
```

```sh [yarn]
yarn add --dev sahne-js puppeteer
```

:::

## Create a response fixture

Create `mock.json` in the directory where you will run Sahne:

```json
{
  "id": 42,
  "name": "Local response",
  "source": "sahne"
}
```

Relative file paths are resolved from the current working directory.

## Create the configuration

Create `sahne.config.ts`:

```ts
import { defineConfig } from 'sahne-js';

export default defineConfig({
  initialUrl: 'https://app.example.com/dashboard',
  interceptor: {
    match: 'https://app.example.com/api/profile',
    file: './mock.json'
  }
});
```

Replace the example URLs with your target page and endpoint. `initialUrl` must be an absolute HTTP or HTTPS URL.

`defineConfig()` returns the object unchanged. Its purpose is to provide editor completion and type checking.

## Run Sahne

The most predictable first run uses an isolated browser:

```sh
npx sahne --browser=launch
```

Sahne launches a browser, installs request interception, and navigates to `initialUrl`. When the page requests the matched endpoint, it receives `mock.json` with status `200` and an `application/json` content type.

All unmatched requests continue normally.

## Add a project script

Once the configuration works, add a script for the team:

```json
{
  "scripts": {
    "sahne": "sahne --browser=launch"
  }
}
```

Run it with:

```sh
npm run sahne
```

## Use your existing Chrome session

An interactive run without `--browser=launch` uses the default `auto` mode. It requests access to Chrome remote debugging so the managed tab can use your existing browser session.

1. Start Chrome.
2. Open `chrome://inspect/#remote-debugging`.
3. Enable remote debugging.
4. Run `npx sahne` and approve Chrome's prompt.

Read [Browser modes](./browser-modes.md) before using connected-browser options or the all-tabs escape hatch.

## Next steps

- [Proxy a local app](./proxy-local-app.md)
- [Learn matching and rule order](./matching-and-rules.md)
- [Inspect every configuration option](../reference/configuration.md)
