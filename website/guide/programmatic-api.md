---
title: Use without the CLI
description: Add Sahne's request interceptor to an existing Puppeteer browser and page lifecycle.
---

# Use without the CLI

Import `Interceptor` when an existing Puppeteer workflow already owns the browser and page.

```ts
import puppeteer from 'puppeteer';
import { Interceptor, type InterceptorConfig } from 'sahne-js';

const rules: InterceptorConfig[] = [
  {
    match: 'https://app.example.com/**',
    ignore: 'https://app.example.com/api/**',
    proxy: 'http://localhost:5173'
  }
];

const browser = await puppeteer.launch({ headless: false });
const [page] = await browser.pages();

await page.setRequestInterception(true);

const interceptor = new Interceptor(rules);
const interceptionErrors: unknown[] = [];

page.on('request', (request) => {
  void interceptor.handleRequest(request).catch((error: unknown) => {
    interceptionErrors.push(error);
    console.error(error);
  });
});

await page.goto('https://app.example.com');
```

## Your code owns the browser

The `Interceptor` class does not:

- Launch or connect to a browser.
- Enable Puppeteer request interception.
- Register or remove page event listeners.
- Navigate a page.
- Close pages or browsers.

It only evaluates the configured rules for the supplied `HTTPRequest` and returns a `Promise<void>` after that request has been resolved or continued.

## Handle listener errors

Puppeteer event emitters do not await promise-returning listeners. Start the promise explicitly with `void` and attach a rejection handler, as in the example above.

If an interception error is handled by a rule's `onError`, `handleRequest()` resolves normally. The catch handler is still useful for failures from Puppeteer's final request action or other unexpected integration errors.

## Reuse the same rule model

The programmatic interceptor supports the same ordered rules, matching, proxying, file responses, overrides, and hooks as the CLI.

The CLI validates a loaded configuration before running it. The `Interceptor` constructor expects an already type-checked `InterceptorConfig` and does not perform that top-level config-file validation.

See the [public API reference](../reference/api.md) for exported types and signatures.
