---
title: Browser modes
description: Choose between an existing Chrome session and an isolated browser, with clear ownership and safety guarantees.
---

# Browser modes

Sahne can connect to an existing Chrome session or launch a browser it owns. The high-level `browser.mode` setting makes that choice explicit.

## Mode behavior

| Mode               | Interactive terminal                   | CI or non-interactive process          |
| ------------------ | -------------------------------------- | -------------------------------------- |
| `auto`             | Request Chrome remote-debugging access | Launch an isolated browser             |
| `remote-debugging` | Require Chrome remote-debugging access | Require Chrome remote-debugging access |
| `launch`           | Launch an isolated browser             | Launch an isolated browser             |

`auto` is the default when no raw Puppeteer launch or connect configuration takes precedence.

```ts
export default defineConfig({
  initialUrl: 'https://app.example.com',
  browser: {
    mode: 'auto'
  }
});
```

## Connected Chrome

To use authenticated browser state:

1. Start the selected Chrome channel.
2. Open `chrome://inspect/#remote-debugging`.
3. Enable remote debugging.
4. Run Sahne and approve Chrome's prompt.

```sh
npx sahne --browser=remote-debugging
```

Sahne asks Puppeteer to discover the browser from the selected Chrome channel. It does not probe a fixed `127.0.0.1:9222` endpoint.

See [Remote-debugging connection](./remote-debugging.md) for the complete setup, approval flow, safety behavior, and connection troubleshooting.

Remote-debugging mode requires Puppeteer 24.32.0 or newer. With an older supported Puppeteer release:

- `auto` warns and launches an isolated browser.
- Explicit `remote-debugging` fails with an upgrade instruction.

## Managed-tab safety

When connected, Sahne:

- Creates one fresh managed tab.
- Enables interception only on that tab.
- Navigates only that tab to `initialUrl`.
- Prefixes its title with `🟢 Sahne — ` by default.
- Brings the managed tab to the front after navigation.
- Closes the managed tab and disconnects on exit.
- Leaves existing and subsequently opened personal tabs alone.

Customize connected-tab behavior with:

```ts
browser: {
  mode: 'remote-debugging',
  channel: 'chrome-beta',
  remoteDebuggingTimeout: 90_000,
  indicator: 'none',
  closeManagedPageOnExit: false
}
```

When a retained managed tab closes, Sahne removes its title marker first. Closing the managed tab manually also ends the Sahne session.

::: danger Intercepting every tab
`browser.dangerouslyEnableForAllTabs: true` applies Sahne rules to every existing and future tab in a connected browser, including authenticated and sensitive pages. Sahne prints a warning. It still does not navigate, mark, or close those personal tabs.
:::

## Isolated launch

Launch mode starts a browser with these Sahne defaults:

```ts
{
  headless: false,
  defaultViewport: null
}
```

Override Puppeteer launch options as needed:

```ts
export default defineConfig({
  initialUrl: 'https://app.example.com',
  browser: { mode: 'launch' },
  puppeteerOptions: {
    launch: {
      headless: true,
      args: ['--incognito']
    }
  }
});
```

Sahne owns a launched browser. It enables interception on the initial page and future pages, then closes the browser on cleanup.

## Selection precedence

The browser choice is resolved in this order:

1. CLI `--browser`
2. `SAHNE_BROWSER_MODE`
3. `browser.mode`
4. Raw `puppeteerOptions.connect` or `puppeteerOptions.launch` when no high-level mode, channel, or timeout is configured
5. The `auto` default

```sh
SAHNE_BROWSER_MODE=launch npx sahne
```

The environment value must be `auto`, `remote-debugging`, or `launch`.

## Raw Puppeteer connection

Advanced workflows can pass Puppeteer connection settings directly:

```ts
puppeteerOptions: {
  connect: {
    browserURL: 'http://127.0.0.1:9222';
  }
}
```

Raw `connect` is mutually exclusive with raw `launch`. It also cannot be combined with high-level browser mode, channel, or remote-debugging timeout settings.
