---
title: Hooks and lifecycle
description: Run asynchronous browser callbacks, control matched requests, recover from failures, and understand cleanup.
---

# Hooks and lifecycle

Sahne provides runner callbacks for browser setup and interceptor hooks for individual requests. Runner callbacks execute once per run. Interceptor hooks execute for every request claimed by their rule.

## Runner callbacks

```ts
export default defineConfig({
  initialUrl: 'https://app.example.com',
  callback: {
    beforeLaunch: async () => {
      // Before Sahne connects to or launches a browser.
    },
    afterLaunch: async (browser) => {
      // The browser is ready, but the managed page is not prepared yet.
    },
    beforeGoto: async (browser, page) => {
      // Interception is installed; navigation has not started.
    },
    afterGoto: async (browser, page) => {
      // initialUrl has finished navigating.
    }
  }
});
```

The historical `beforeLaunch` and `afterLaunch` names are also used when Sahne connects instead of launching.

| Callback       | Arguments         | Timing                                      |
| -------------- | ----------------- | ------------------------------------------- |
| `beforeLaunch` | None              | Before browser acquisition                  |
| `afterLaunch`  | `Browser`         | After browser acquisition                   |
| `beforeGoto`   | `Browser`, `Page` | After interception setup, before navigation |
| `afterGoto`    | `Browser`, `Page` | After navigation completes                  |

Callbacks can return a value, a promise, or another promise-like value. A thrown or rejected callback fails the runner with a named hook error.

## Request actions

`onRequest`, `onResponse`, and `onError` receive an `action` object:

| Action                     | Effect                                            |
| -------------------------- | ------------------------------------------------- |
| `action.abort()`           | Cancel the browser request.                       |
| `action.ignore()`          | Continue the original browser request.            |
| `action.respond(response)` | Supply a Puppeteer response immediately.          |
| `action.next()`            | Let the next interceptor rule handle the request. |

`abort`, `ignore`, and `respond` are asynchronous. `next` is synchronous.

## Inspect a matched request

`onRequest` runs after `match` and before a file or proxy is read:

```ts
interceptor: {
  match: '/api/orders',
  proxy: 'http://localhost:4000',
  onRequest: async ({ request, url, action }) => {
    if (request.method() !== 'GET') {
      await action.abort();
      return;
    }

    console.log('Loading', url.pathname);
  }
}
```

If the hook does not resolve or advance the request, normal processing continues.

## Inspect a source response

`onResponse` runs after response predicates and before Sahne sends the configured result:

```ts
onResponse: async ({ response, responseFromProxyRequest, request, action }) => {
  console.log(request.url(), response.status);

  if (responseFromProxyRequest?.headers.get('x-preview') === 'blocked') {
    await action.abort();
  }
};
```

`responseFromProxyRequest` is available only for proxy-backed rules.

## Recover from a rule failure

`onError` receives the typed Sahne error, the request, the parsed URL, and the same action methods:

```ts
onError: async (error, { request, action }) => {
  console.error('Sahne could not handle', request.url(), error);

  await action.respond({
    status: 502,
    headers: { 'content-type': 'text/plain' },
    body: 'Local proxy unavailable'
  });
};
```

Instead of using an action, return a Puppeteer `ResponseForRequest`. Sahne passes it through the rule's normal response stage, including response overrides and hooks.

If `onError` returns nothing and performs no action, Sahne moves to the next rule.

## Process cleanup

On Ctrl+C, SIGTERM, browser disconnection, or managed-tab closure, Sahne interrupts in-flight handlers and removes request listeners.

- A launched browser is closed.
- A connected browser remains open and Sahne disconnects its client.
- The connected managed tab is closed by default.
- A retained managed tab has its title marker removed.

Missing, invalid, or unloadable configuration files are reported on stderr and exit with status `1`.
