---
title: Rewrite and override
description: Change proxy destinations, outgoing requests, and responses returned to the browser.
---

# Rewrite and override

Sahne separates destination rewrites from request and response data overrides. This makes it possible to move a request to another server without changing its payload, or transform a live response without changing its destination.

## Rewrite the proxy destination

A string `proxy` replaces the protocol, hostname, and port while preserving the original path and query:

```ts
interceptor: {
  match: 'https://app.example.com/**',
  proxy: 'http://localhost:5173'
}
```

You can calculate the entire destination instead:

```ts
interceptor: {
  match: '/api/**',
  proxy: (requestUrl, request) => {
    const url = new URL(requestUrl);
    url.host = request.method() === 'GET' ? 'localhost:4000' : 'localhost:4001';
    url.protocol = 'http:';
    return url.href;
  }
}
```

After `proxy` is resolved, Sahne applies `urlRewrite` and then `pathRewrite`:

```ts
interceptor: {
  match: '/legacy/**',
  proxy: 'http://localhost:5173',
  urlRewrite: (url) => url.replace('/legacy/', '/api/'),
  pathRewrite: (path) => `/v2${path}`
}
```

- `urlRewrite(url, request)` receives and returns the complete proxy URL.
- `pathRewrite(path, request)` receives only the proxy URL pathname.

## Override the outgoing request

Request overrides run after the proxy URL is known and before Sahne calls `fetch`.

```ts
interceptor: {
  match: '/api/orders',
  proxy: 'http://localhost:4000',
  overrideRequestHeaders: (headers, { proxyUrl, request }) => ({
    ...headers,
    'x-sahne-target': new URL(proxyUrl).host,
    'x-original-method': request.method()
  }),
  overrideRequestBody: (body) =>
    JSON.stringify({ ...JSON.parse(body ?? '{}'), preview: true }),
  overrideRequestOptions: (options) => ({
    ...options,
    redirect: 'manual'
  })
}
```

`overrideRequestHeaders` and `overrideRequestOptions` also accept partial objects, which are merged into the current value:

```ts
overrideRequestHeaders: {
  'x-sahne': 'true'
}
```

The body override replaces the body. Do not add a body to a method for which the Fetch API forbids one.

## Override the browser response

Focused response overrides receive the source response and the original request:

```ts
interceptor: {
  match: '/api/profile',
  proxy: 'http://localhost:4000',
  overrideResponseHeaders: (headers, { request }) => ({
    ...headers,
    'cache-control': 'no-store',
    'x-original-url': request.url()
  }),
  overrideResponseBody: (body) => {
    const profile = JSON.parse(body.toString());
    return JSON.stringify({ ...profile, localPreview: true });
  },
  overrideResponseOptions: (response) => ({
    ...response,
    status: 200
  })
}
```

The additional response parameters are:

- `response`: the normalized Puppeteer response.
- `responseFromProxyRequest`: the raw Fetch `Response`, when the source was a proxy.
- `request`: the original Puppeteer `HTTPRequest`.

File responses do not have `responseFromProxyRequest`.

::: info Overrides are synchronous
Override functions return values directly. Use the asynchronous `onRequest`, `onResponse`, or `onError` hooks when work must be awaited.
:::

## Take complete control in a hook

`onResponse` can inspect the source and use an action instead of the configured response:

```ts
onResponse: async ({ response, action }) => {
  if (response.status === 204) {
    await action.respond({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"empty":true}'
    });
  }
};
```

Once an action resolves the request, Sahne does not send another response.
