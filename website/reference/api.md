---
title: Public API
description: Exports available from the sahne-js package for TypeScript and Puppeteer integrations.
---

# Public API

The package root exposes the CLI-oriented config helper, the programmatic interceptor, and the public configuration types.

```ts
import {
  Interceptor,
  defineConfig,
  type InterceptorConfig,
  type Match,
  type SahneBrowserChannel,
  type SahneBrowserMode,
  type SahneConfig,
  type SahnePageIndicator
} from 'sahne-js';
```

SahneJS v2 is ESM-only.

## `defineConfig`

```ts
function defineConfig(options: SahneConfig): SahneConfig;
```

Returns the supplied object unchanged. Use it in `sahne.config.ts` for contextual type checking and editor completion.

```ts
export default defineConfig({
  initialUrl: 'https://app.example.com',
  interceptor: {
    match: '/api/profile',
    file: './profile.json'
  }
});
```

## `Interceptor`

```ts
class Interceptor {
  constructor(configs: InterceptorConfig | InterceptorConfig[]);
  handleRequest(request: HTTPRequest): Promise<void>;
}
```

Evaluates the supplied rules for one Puppeteer `HTTPRequest`. If no rule resolves the request, it calls `request.continue()`.

```ts
await page.setRequestInterception(true);

const interceptor = new Interceptor({
  match: '/api/profile',
  file: './profile.json'
});

page.on('request', (request) => {
  void interceptor.handleRequest(request).catch(console.error);
});
```

The class does not own the browser, page, interception setting, or event listener. See [Use without the CLI](../guide/programmatic-api.md).

## `SahneConfig`

```ts
interface SahneConfig {
  initialUrl: string;
  puppeteerOptions?: {
    goto?: GoToOptions;
    launch?: Partial<LaunchOptions>;
    connect?: ConnectOptions;
  };
  browser?: {
    mode?: SahneBrowserMode;
    channel?: SahneBrowserChannel;
    remoteDebuggingTimeout?: number;
    indicator?: SahnePageIndicator;
    closeManagedPageOnExit?: boolean;
    dangerouslyEnableForAllTabs?: boolean;
  };
  interceptor?: InterceptorConfig | InterceptorConfig[];
  callback?: RunnerCallbacks;
}
```

See the [configuration reference](./configuration.md) for property behavior and constraints.

## `InterceptorConfig`

```ts
type InterceptorConfig = ConfigForProxy | ConfigForFile;
```

A rule can use a proxy or a file, but not both. Common routing, response, and hook properties are shared by both variants.

See the [`interceptor` reference](./configuration.md#interceptor).

## `Match`

```ts
type Match = string | RegExp | ((url: URL, request: HTTPRequest) => boolean);
```

See [Matching and rule order](../guide/matching-and-rules.md).

## Browser types

```ts
type SahneBrowserMode = 'auto' | 'remote-debugging' | 'launch';

type SahneBrowserChannel = 'chrome' | 'chrome-beta' | 'chrome-canary' | 'chrome-dev';

type SahnePageIndicator = 'title' | 'none';
```

## Runtime contract

- Node.js 22.18 or newer
- ESM imports
- Puppeteer 20 through 25 as a peer dependency
- Puppeteer 24.32 or newer for Chrome channel-based remote-debugging discovery
