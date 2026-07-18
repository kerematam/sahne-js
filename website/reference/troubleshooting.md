---
title: Troubleshooting
description: Diagnose configuration, Chrome connection, matching, proxy, fixture, and Vite HMR problems.
---

# Troubleshooting

Start with the error printed by Sahne. Configuration, browser, navigation, hook, proxy, and file failures are reported with a short operation-specific message rather than Effect internals.

## Sahne cannot find the configuration

Without a flag, Sahne looks for exactly `sahne.config.ts` in the current working directory.

Check the directory from which the command runs, or provide an explicit file:

```sh
npx sahne --file ./config/sahne.preview.ts
```

The configuration must be importable by Node.js and should default-export a `SahneConfig` object.

## Chrome remote debugging times out

For `auto` in an interactive terminal or explicit `remote-debugging` mode:

1. Start the configured Chrome channel.
2. Open `chrome://inspect/#remote-debugging`.
3. Enable remote debugging.
4. Run Sahne again.
5. Approve the Chrome prompt before the timeout.

Increase the approval window if needed:

```ts
browser: {
  mode: 'remote-debugging',
  remoteDebuggingTimeout: 120_000
}
```

Or use an isolated browser:

```sh
npx sahne --browser=launch
```

## Remote debugging requires a newer Puppeteer

Chrome channel discovery requires Puppeteer 24.32.0 or newer. Upgrade the peer dependency:

```sh
npm install --save-dev puppeteer@latest
```

Sahne still supports older peer versions for launch and raw connection workflows.

## A rule does not match

Check these behaviors:

- A relative string such as `/api/**` is resolved against the request origin.
- Query strings are removed during matching.
- `*` does not cross `/`; use `**` for multiple path segments.
- Match arrays use OR semantics.
- A predicate's `URL` has no query; inspect `request.url()` when the query matters.
- A rule without `match` does not claim a response. Use `match: '**'` for a catch-all.

Temporarily use a predicate to inspect the values:

```ts
match: (url, request) => {
  console.log({ matchingUrl: url.href, originalUrl: request.url() });
  return true;
};
```

## An API request bypasses later rules

`ignore` continues the original request immediately and ends the entire pipeline. It does not mean “skip this rule.”

Use `next` when the following rule should receive the request:

```ts
{
  match: '**',
  next: '/api/**',
  proxy: 'http://localhost:5173'
}
```

## A local fixture cannot be read

Relative `file` paths are resolved from the current working directory, not from the configuration file's directory.

Either start Sahne from the expected project directory or calculate an absolute path in the config.

## The local application does not load

- Start the development server before Sahne.
- Confirm its host and port match `proxy`.
- Use `strictPort: true` so Vite does not move silently.
- Open the local server directly once to confirm it responds.
- Narrow or log the rule to confirm the asset URLs match.
- Check whether a target page's Content Security Policy blocks scripts or connections required by the local build.

## Vite updates do not arrive

Configure Vite's WebSocket client with an address the target page can reach:

```ts
server: {
  strictPort: true,
  ws: {
    protocol: 'ws',
    host: 'localhost',
    clientPort: 5173
  }
}
```

See [Proxy a local app](../guide/proxy-local-app.md#configure-vite-hmr).

## The application title assertion fails

Connected-browser mode prefixes the managed tab title with `🟢 Sahne — ` by default. Disable the visual marker for tests that assert the exact title:

```ts
browser: {
  indicator: 'none';
}
```

## Personal tabs are being intercepted

This happens only when `browser.dangerouslyEnableForAllTabs` is explicitly `true` or when your own raw Puppeteer integration attaches the interceptor broadly.

Remove the option to restore the safe connected-browser default. Sahne will create and manage only one fresh tab.

## Report a reproducible issue

Include the Sahne version, Node version, Puppeteer version, browser mode, a minimized configuration, and the exact error. Remove credentials, cookies, private URLs, and response data before posting.

[Open a GitHub issue](https://github.com/kerematam/sahne-js/issues)
