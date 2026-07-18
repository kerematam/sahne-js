---
title: Configuration reference
description: Complete reference for SahneConfig, browser acquisition, interceptor rules, overrides, and hooks.
---

# Configuration reference

The default configuration file is `sahne.config.ts` in the current working directory. Export the object as the default export:

```ts
import { defineConfig } from 'sahne-js';

export default defineConfig({
  initialUrl: 'https://app.example.com',
  interceptor: {
    match: '/api/profile',
    file: './fixtures/profile.json'
  }
});
```

Use [`--file`](./cli.md#file) to load another path.

## `SahneConfig`

| Property           | Type                                       | Required | Description                                              |
| ------------------ | ------------------------------------------ | -------- | -------------------------------------------------------- |
| `initialUrl`       | `string`                                   | Yes      | Absolute HTTP or HTTPS URL opened after browser setup.   |
| `interceptor`      | `InterceptorConfig \| InterceptorConfig[]` | No       | One rule or an ordered list of rules.                    |
| `browser`          | `BrowserOptions`                           | No       | High-level browser selection and connected-tab behavior. |
| `puppeteerOptions` | `PuppeteerOptions`                         | No       | Raw options passed to Puppeteer.                         |
| `callback`         | `RunnerCallbacks`                          | No       | Hooks around browser acquisition and initial navigation. |

Unknown properties are preserved, but Sahne only acts on documented fields.

### `initialUrl`

`initialUrl` must be a non-empty absolute URL using `http:` or `https:`.

```ts
initialUrl: 'https://app.example.com/dashboard';
```

Relative paths and other protocols fail config validation.

## `browser`

```ts
browser: {
  mode: 'auto',
  channel: 'chrome',
  remoteDebuggingTimeout: 60_000,
  indicator: 'title',
  closeManagedPageOnExit: true,
  dangerouslyEnableForAllTabs: false
}
```

| Property                      | Type                                                           | Default    | Description                                                                 |
| ----------------------------- | -------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `mode`                        | `'auto' \| 'remote-debugging' \| 'launch'`                     | `'auto'`   | How Sahne acquires a browser.                                               |
| `channel`                     | `'chrome' \| 'chrome-beta' \| 'chrome-canary' \| 'chrome-dev'` | `'chrome'` | Channel used by connected-browser modes.                                    |
| `remoteDebuggingTimeout`      | `number`                                                       | `60_000`   | Positive finite milliseconds to wait for discovery and Chrome approval.     |
| `indicator`                   | `'title' \| 'none'`                                            | `'title'`  | Whether the connected managed tab gets the `🟢 Sahne — ` title prefix.      |
| `closeManagedPageOnExit`      | `boolean`                                                      | `true`     | Whether Sahne closes its managed connected-browser tab during cleanup.      |
| `dangerouslyEnableForAllTabs` | `boolean`                                                      | `false`    | Apply interception to every existing and future tab in a connected browser. |

`channel` and `remoteDebuggingTimeout` cannot be used with `mode: 'launch'`. High-level mode, channel, and timeout settings cannot be combined with raw `puppeteerOptions.connect`.

See [Browser modes](../guide/browser-modes.md) for selection precedence, ownership, and safety behavior.

## `puppeteerOptions`

| Property  | Type                     | Description                              |
| --------- | ------------------------ | ---------------------------------------- |
| `goto`    | `GoToOptions`            | Passed to `page.goto(initialUrl, goto)`. |
| `launch`  | `Partial<LaunchOptions>` | Merged over Sahne's launch defaults.     |
| `connect` | `ConnectOptions`         | Passed through to `puppeteer.connect()`. |

Raw `launch` and `connect` are mutually exclusive.

```ts
puppeteerOptions: {
  goto: {
    waitUntil: 'networkidle2',
    timeout: 45_000
  },
  launch: {
    headless: true,
    args: ['--incognito']
  }
}
```

Sahne's launch defaults are `headless: false` and `defaultViewport: null`; supplied launch values override them.

## `callback`

| Callback       | Signature                                              | Timing                                              |
| -------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `beforeLaunch` | `() => MaybePromise<void>`                             | Before launch or connection begins.                 |
| `afterLaunch`  | `(browser: Browser) => MaybePromise<void>`             | After launch or connection succeeds.                |
| `beforeGoto`   | `(browser: Browser, page: Page) => MaybePromise<void>` | After interception is installed, before navigation. |
| `afterGoto`    | `(browser: Browser, page: Page) => MaybePromise<void>` | After navigation completes.                         |

The launch-oriented names are retained in connection mode for compatibility.

## `interceptor`

Pass one rule or an ordered array:

```ts
interceptor: [
  { match: '/api/profile', file: './fixtures/profile.json' },
  { match: '/api/**', proxy: 'http://localhost:4000' }
];
```

### Match type

```ts
type Match = string | RegExp | ((url: URL, request: HTTPRequest) => boolean);
```

Every match field accepts `Match` or `Match[]`. See [Matching and rule order](../guide/matching-and-rules.md) for glob behavior and evaluation order.

### Request routing fields

| Property    | Type                                              | Description                                                           |
| ----------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| `ignore`    | `Match \| Match[]`                                | Continue the original request immediately.                            |
| `abort`     | `Match \| Match[]`                                | Cancel the request immediately.                                       |
| `next`      | `Match \| Match[]`                                | Advance to the following rule immediately.                            |
| `match`     | `Match \| Match[]`                                | Claim the request for this rule.                                      |
| `onRequest` | `(params: OnRequestParams) => MaybePromise<void>` | Inspect or resolve a claimed request before its response source runs. |

The routing controls are checked in the order shown. They are not scoped by `match` because they execute before it.

### Response source fields

| Property | Type                                          | Description                                       |
| -------- | --------------------------------------------- | ------------------------------------------------- |
| `file`   | `string \| ((requestUrl, request) => string)` | Read a local file as the response body.           |
| `proxy`  | `string \| ((requestUrl, request) => string)` | Fetch the response from an alternate destination. |

`file` and `proxy` cannot be present in the same rule.

When neither is present, Sahne fetches the original request URL. This is useful for transforming a live request or response without changing its destination.

### Proxy rewrite fields

| Property      | Signature                                        | Description                     |
| ------------- | ------------------------------------------------ | ------------------------------- |
| `urlRewrite`  | `(url: string, request: HTTPRequest) => string`  | Rewrite the complete proxy URL. |
| `pathRewrite` | `(path: string, request: HTTPRequest) => string` | Rewrite only the pathname.      |

Sahne resolves `proxy`, then runs `urlRewrite`, then `pathRewrite`.

### Request override fields

| Property                 | Value                                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| `overrideRequestOptions` | `Partial<RequestInit>` or `(options, additionalParams) => RequestInit` |
| `overrideRequestHeaders` | Partial headers or `(headers, additionalParams) => HeadersInit`        |
| `overrideRequestBody`    | A replacement body or `(body, additionalParams) => BodyInit`           |

The additional request parameters are:

```ts
type OverrideRequestAdditionalParams = {
  proxyUrl: string;
  request: HTTPRequest;
};
```

Request option and header objects are merged. A body value replaces the current body.

### Response override fields

| Property                  | Value                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `overrideResponseOptions` | Partial `ResponseForRequest` or `(response, additionalParams) => ResponseForRequest` |
| `overrideResponseHeaders` | Partial headers or `(headers, additionalParams) => ResponseForRequest['headers']`    |
| `overrideResponseBody`    | A replacement body or `(body, additionalParams) => ResponseForRequest['body']`       |

The additional response parameters are:

```ts
type OverrideResponseAdditionalParams = {
  responseFromProxyRequest?: Response;
  response: ResponseForRequest;
  request: HTTPRequest;
};
```

Override functions are synchronous. Focused header and body overrides are applied independently of the full options override.

### Response routing fields

| Property           | Signature                                                   | Result when it returns `true`  |
| ------------------ | ----------------------------------------------------------- | ------------------------------ |
| `ignoreOnResponse` | `(params: ActionOnResponseParams) => MaybePromise<boolean>` | Continue the original request. |
| `abortOnResponse`  | `(params: ActionOnResponseParams) => MaybePromise<boolean>` | Cancel the request.            |
| `nextOnResponse`   | `(params: ActionOnResponseParams) => MaybePromise<boolean>` | Advance to the next rule.      |

These predicates run in the table order. They must return a boolean.

### `onResponse`

```ts
onResponse?: (params: {
  response: ResponseForRequest;
  responseFromProxyRequest?: Response;
  action: Action;
  request: HTTPRequest;
  url: URL;
}) => MaybePromise<void>;
```

The hook runs after response predicates and before Sahne sends the configured response.

### `onError`

```ts
onError?: (
  error: unknown,
  params: {
    request: HTTPRequest;
    action: Action;
    url: URL;
  }
) => MaybePromise<void | ResponseForRequest>;
```

The hook can resolve the request with an action or return a fallback response. Otherwise, processing moves to the next rule.

### `Action`

```ts
type Action = {
  abort: () => Promise<void>;
  respond: (params: ResponseForRequest) => Promise<void>;
  ignore: () => Promise<void>;
  next: () => void;
};
```

See [Hooks and lifecycle](../guide/hooks-and-lifecycle.md) for complete examples.
