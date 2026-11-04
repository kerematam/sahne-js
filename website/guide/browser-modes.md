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
- Explicit channel connections require upgrading Puppeteer.
- Explicit `remote-debugging` fails with an upgrade instruction.

## Choose a Chrome profile

Configure the Puppeteer connection explicitly and give Sahne the profile directory
for its managed tab:

```ts
export default defineConfig({
  initialUrl: 'https://app.example.com',
  puppeteerOptions: {
    connect: { channel: 'chrome' }
  },
  browser: {
    profileDirectory: 'Profile 2'
  }
});
```

`puppeteerOptions.connect` is passed through to Puppeteer. It can specify a Chrome
channel or an explicit `browserURL` / `browserWSEndpoint`. An explicit connection
ignores `SAHNE_BROWSER_MODE`, CI, and terminal detection. Combining it with
`--browser`, `browser.mode`, `browser.channel`, or launch options is an error.
`browser.remoteDebuggingTimeout` applies to both channel and endpoint connections
and defaults to 60 seconds.

`browser.profileDirectory` is Sahne's Chrome-specific selection after connecting.
Use the directory at the end of **Profile Path** on `chrome://version/`, such as
`Default` or `Profile 2`. It requires a CDP connection or the existing explicit
`browser.mode: 'remote-debugging'`. It cannot be used with launch mode, auto mode,
or WebDriver BiDi, and never changes the browser mode.

The profile value comes only from your config. Environment loading and mapping
belong to the consuming project. For example:

```ts
import 'dotenv/config';
import { defineConfig } from 'sahne-js';

export default defineConfig({
  initialUrl: 'https://app.example.com',
  puppeteerOptions: { connect: { channel: 'chrome' } },
  browser: {
    profileDirectory: process.env.CHROME_PROFILE?.trim() || undefined
  }
});
```

Sahne selects among regular profile contexts Chrome exposes to the connection.
It creates temporary tabs to read `chrome://version/`, closes rejected probes,
and reuses the matching tab as its managed page. Existing tabs are never used as
probes. Incognito/automation contexts are excluded.

If the requested profile is unavailable, Sahne closes its probes and reports the
available directories before application navigation. Open the desired profile,
enable `chrome://inspect/#remote-debugging` there, and reconnect.

Without a selector, CDP connections pin the managed tab to Chrome's connected
default context when available. Older Chrome versions without that context ID
retain the previous new-tab behavior. BiDi connections retain ordinary Puppeteer
page creation.

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

An explicit `puppeteerOptions.connect` is authoritative: it ignores environment
mode and rejects CLI `--browser`, `browser.mode`, `browser.channel`, and launch
options. Without an explicit connection, mode is resolved in this order:

1. CLI `--browser`
2. `SAHNE_BROWSER_MODE`
3. `browser.mode`
4. Raw `puppeteerOptions.launch` when no high-level mode, channel, or timeout is configured
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
    browserURL: 'http://127.0.0.1:9222'
  }
}
```

Explicit `connect` is mutually exclusive with raw `launch`, CLI `--browser`, and high-level browser mode or channel. `browser.remoteDebuggingTimeout` applies to explicit connections.
