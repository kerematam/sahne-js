---
title: How Sahne works
description: Understand the request pipeline, rule evaluation, response sources, and browser ownership model.
---

# How Sahne works

Sahne combines two independent pieces: a browser runner and a request interceptor. The CLI owns both. The exported `Interceptor` class lets you use only the request-processing piece.

## The browser runner

The runner performs these steps:

1. Resolve whether to connect to Chrome or launch an isolated browser.
2. Acquire the browser and choose or create the page Sahne owns.
3. Enable Puppeteer request interception before navigation.
4. Navigate to `initialUrl`.
5. Keep processing requests until the browser disconnects, the managed tab closes, or the process is interrupted.
6. Remove listeners and close or disconnect the resources Sahne owns.

When Sahne launches a browser, it owns that browser and closes it on exit. When Sahne connects to Chrome, it creates one managed tab and disconnects without closing Chrome.

## The request pipeline

Each intercepted request moves through the configured rules in array order.

<div class="rule-order" aria-label="Request pipeline">
  <div>Match a rule</div>
  <div>Build a source</div>
  <div>Transform response</div>
  <div>Resolve request</div>
</div>

Within a rule, request controls are evaluated in this order:

1. `ignore` — continue the original request immediately.
2. `abort` — cancel the request immediately.
3. `next` — skip to the following rule.
4. `match` — decide whether the rule handles the request.
5. `onRequest` — inspect the match and optionally resolve it manually.

If the rule still owns the request, Sahne gets a response from `file` or `proxy`. When neither is set, `proxy` defaults to the original request URL, which allows a rule to transform a live response.

Response handling then runs in this order:

1. Calculate the configured response overrides.
2. Evaluate `ignoreOnResponse`, `abortOnResponse`, and `nextOnResponse`.
3. Run `onResponse`.
4. Respond with the transformed result if a hook has not already resolved the request.

If no rule resolves a request, Sahne continues it to its original destination exactly once.

## URL matching and proxying are different

Sahne removes the query string while evaluating `match`, `ignore`, `abort`, and `next`. This keeps routing rules stable across changing query parameters.

The original URL, including its query, is still used when building a proxy request. A predicate that needs query data can inspect the supplied Puppeteer `request`:

```ts
interceptor: {
  match: (_url, request) => new URL(request.url()).searchParams.has('preview'),
  proxy: 'http://localhost:5173'
}
```

## Errors move to the next rule

If a matched rule fails while reading a file, contacting a proxy, or running a hook, Sahne logs the typed error and calls that rule's `onError` hook.

The hook can resolve the request through `action`, return a fallback response, or allow processing to move to the next rule. If no later rule resolves the request, the original request continues.

```ts
interceptor: {
  match: '/api/profile',
  proxy: 'http://localhost:9999',
  onError: () => ({
    status: 503,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ available: false }),
    contentType: 'application/json'
  })
}
```

## Learn the individual stages

- [Matching and rule order](./matching-and-rules.md)
- [Rewrite and override](./rewrite-and-override.md)
- [Hooks and lifecycle](./hooks-and-lifecycle.md)
