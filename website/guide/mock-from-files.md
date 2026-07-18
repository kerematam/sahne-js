---
title: Mock responses from files
description: Return static or dynamically selected local files for matched browser requests.
---

# Mock responses from files

Use `file` when a matched request should receive a local fixture instead of contacting a server.

## Return a JSON fixture

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

Relative paths are read from the directory where the Sahne process was started. Use an absolute path when the configuration must work from multiple working directories.

File responses default to:

| Property     | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Status       | `200`                                                  |
| Headers      | Empty                                                  |
| Content type | `application/json` for `.json`; otherwise `text/plain` |
| Body         | The file bytes                                         |

## Select a file dynamically

The `file` value can be a function receiving the original request URL and Puppeteer's `HTTPRequest`:

```ts
import { defineConfig } from 'sahne-js';

export default defineConfig({
  initialUrl: 'https://app.example.com',
  interceptor: {
    match: '/api/accounts/**',
    file: (requestUrl, request) => {
      const accountId = new URL(requestUrl).pathname.split('/').at(-1);
      const mobile = request.headers()['x-client'] === 'mobile';
      return `./fixtures/accounts/${accountId}${mobile ? '-mobile' : ''}.json`;
    }
  }
});
```

## Customize the response

Use focused response overrides for headers or body, or `overrideResponseOptions` for status and other Puppeteer response fields:

```ts
interceptor: {
  match: '/api/profile',
  file: './fixtures/profile.json',
  overrideResponseOptions: (response) => ({
    ...response,
    status: 201
  }),
  overrideResponseHeaders: (headers) => ({
    ...headers,
    'cache-control': 'no-store',
    'x-sahne-fixture': 'profile'
  })
}
```

`file` and `proxy` are mutually exclusive within one rule. Use separate ordered rules when some matching requests should use files and others should use a server.

## Recover from missing files

A missing or unreadable file is passed to `onError`. Return a Puppeteer response to provide a fallback:

```ts
interceptor: {
  match: '/api/profile',
  file: './fixtures/profile.json',
  onError: (error) => ({
    status: 500,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ error: String(error) }),
    contentType: 'application/json'
  })
}
```

Without a recovery response or action, Sahne logs the error and gives the next interceptor rule a chance to handle the request.
