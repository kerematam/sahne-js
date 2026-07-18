---
title: Matching and rule order
description: Compose URL globs, regular expressions, predicates, and ordered interceptor rules correctly.
---

# Matching and rule order

An interceptor configuration is either one rule or an array evaluated from top to bottom. The first rule that resolves the request ends the pipeline.

## Match values

`match`, `ignore`, `abort`, and `next` accept one value or an array of values:

```ts
type Match = string | RegExp | ((url: URL, request: HTTPRequest) => boolean);
```

An array uses OR semantics: the first matching entry succeeds.

### String globs

A string that does not start with `*` is resolved against the request origin. These two rules are equivalent for a request to `https://app.example.com`:

```ts
match: '/api/**';
```

```ts
match: 'https://app.example.com/api/**';
```

Useful glob syntax:

| Pattern     | Meaning                                                     |
| ----------- | ----------------------------------------------------------- |
| `*`         | Any characters except `/`                                   |
| `**`        | Any number of path segments when used at a segment boundary |
| `?`         | One character                                               |
| `{one,two}` | Either grouped value                                        |
| `[0-9]`     | A regular-expression-style character class                  |

Examples:

```ts
match: '/api/users/*';
match: '**/assets/**';
match: '/images/*.{png,jpg,webp}';
```

### Regular expressions

Regular expressions are tested against the absolute request URL without its query string:

```ts
match: /^https:\/\/([^.]+\.)?example\.com\/api\//;
```

### Predicates

Predicates receive a `URL` and the original Puppeteer request:

```ts
match: (url, request) => url.pathname.startsWith('/api/') && request.method() === 'POST';
```

The supplied `url` has no query string. Read `request.url()` when query parameters matter:

```ts
match: (_url, request) => new URL(request.url()).searchParams.get('mode') === 'preview';
```

::: tip Queries are preserved for the proxy
Removing the query applies only to rule matching. Proxy URL construction still starts from the original request URL.
:::

## Control order inside a rule

Request controls run before `match`:

| Order | Field       | Result when it matches                                              |
| ----- | ----------- | ------------------------------------------------------------------- |
| 1     | `ignore`    | Continue the original browser request and stop all rule processing. |
| 2     | `abort`     | Cancel the browser request and stop all rule processing.            |
| 3     | `next`      | Move immediately to the following rule.                             |
| 4     | `match`     | Claim the request for this rule.                                    |
| 5     | `onRequest` | Inspect or resolve the claimed request manually.                    |

Because `ignore`, `abort`, and `next` are checked independently, they act as early routing controls rather than filters scoped by `match`.

Omitting `match` does not create a catch-all response rule. Use `match: '**'` or `match: () => true` explicitly.

## Compose ordered rules

This configuration leaves other origins alone, proxies application resources, sends one endpoint to a fixture, and adds a header to two endpoints:

```ts
import { defineConfig } from 'sahne-js';

const target = 'https://app.example.com';

export default defineConfig({
  initialUrl: target,
  interceptor: [
    {
      ignore: ({ origin }) => origin !== target
    },
    {
      match: () => true,
      proxy: 'http://localhost:5173',
      next: '/api/**',
      ignore: '/api/redirect'
    },
    {
      match: '/api/profile',
      file: './fixtures/profile.json'
    },
    {
      match: ['/api/orders', '/api/invoices'],
      overrideRequestHeaders: (headers) => ({
        ...headers,
        'x-sahne': 'true'
      })
    }
  ]
});
```

The final rule has no explicit proxy. Sahne requests the original URL, applies the header override, and supplies that live response to the browser.

## Route after receiving a response

Response predicates run after Sahne has read a file or received a proxy response:

```ts
interceptor: [
  {
    match: '/api/profile',
    proxy: 'http://localhost:5173',
    nextOnResponse: ({ response }) => response.status === 404
  },
  {
    match: '/api/profile',
    file: './fixtures/profile-fallback.json'
  }
];
```

The response predicates may be asynchronous and must return a boolean:

- `ignoreOnResponse` continues the original request.
- `abortOnResponse` cancels the request.
- `nextOnResponse` gives the next rule a chance.
