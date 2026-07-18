---
title: Remote-debugging connection
description: Connect SahneJS to an existing Chrome session through Chrome's permission-based remote-debugging flow.
---

# Remote-debugging connection

Remote-debugging mode connects Sahne to an existing Chrome session. Use it when the target page needs browser state that already exists in your regular profile, such as authentication, cookies, local storage, extensions, or certificates.

Sahne creates a fresh managed tab for the run. Your existing tabs remain open and are not intercepted by default.

## Requirements

- Puppeteer 24.32.0 or newer
- An installed Chrome channel supported by Sahne
- Access to `chrome://inspect/#remote-debugging`
- Permission to test the configured target site

::: warning Treat connected sessions as sensitive
The managed tab uses your existing Chrome session. Only run configurations you trust, and keep match rules as narrow as practical.
:::

## Configure the connection

Set the browser mode explicitly in `sahne.config.ts`:

```ts
import { defineConfig } from 'sahne-js';

export default defineConfig({
  initialUrl: 'https://app.example.com/dashboard',
  browser: {
    mode: 'remote-debugging'
  },
  interceptor: {
    match: 'https://app.example.com/**',
    ignore: 'https://app.example.com/api/**',
    proxy: 'http://localhost:5173'
  }
});
```

You can also select the mode for one run without changing the configuration:

```sh
npx sahne --browser=remote-debugging
```

The CLI flag overrides `SAHNE_BROWSER_MODE` and `browser.mode`.

## Enable Chrome remote debugging

1. Start Chrome.
2. Open `chrome://inspect/#remote-debugging` in that Chrome session.
3. Enable remote debugging.
4. Leave Chrome open.
5. Run Sahne from your project directory.
6. Approve Chrome's connection prompt.

Sahne waits up to 60 seconds for Chrome discovery and approval. After the connection succeeds, it creates a managed tab, installs request interception, navigates to `initialUrl`, and brings the tab to the front.

The managed tab is marked with a `🟢 Sahne — ` title prefix by default.

## Use `auto` for interactive development

`auto` is the default browser mode. In an interactive terminal it follows the same remote-debugging connection flow:

```sh
npx sahne
```

In CI or another non-interactive process, `auto` launches an isolated browser instead. Use explicit `remote-debugging` when failure to connect should be an error rather than a reason to launch.

## Select a Chrome channel

Chrome stable is the default. Select another installed channel when needed:

```ts
browser: {
  mode: 'remote-debugging',
  channel: 'chrome-beta'
}
```

Supported values are:

- `chrome`
- `chrome-beta`
- `chrome-canary`
- `chrome-dev`

Open the remote-debugging page and approve the request in the same channel configured here.

## Change the approval timeout

Increase the discovery and approval window for a slow or manual setup:

```ts
browser: {
  mode: 'remote-debugging',
  remoteDebuggingTimeout: 120_000
}
```

The value is a positive finite number in milliseconds.

## Understand tab ownership

For a normal connected session, Sahne:

- Creates and navigates one fresh managed tab.
- Intercepts requests only in that managed tab.
- Leaves existing and subsequently opened personal tabs untouched.
- Closes its managed tab when the run ends.
- Disconnects its Puppeteer client without closing Chrome.

Closing the managed tab manually ends the Sahne session. Pressing Ctrl+C also performs connected-session cleanup.

Retain the managed tab after Sahne exits with:

```ts
browser: {
  mode: 'remote-debugging',
  closeManagedPageOnExit: false
}
```

Sahne removes the title marker before leaving a retained tab open. Set `indicator: 'none'` when the application or a test requires an exact page title.

::: danger All-tabs interception
`dangerouslyEnableForAllTabs: true` applies your rules to every existing and future tab in the connected browser, including authenticated and sensitive pages. It is unnecessary for the standard managed-tab workflow.
:::

## How discovery works

High-level remote-debugging mode asks Puppeteer to connect through the configured Chrome channel. Puppeteer reads Chrome's active debugging information, so Sahne does not scan or assume `127.0.0.1:9222`.

For an intentional classic debugging endpoint, use raw Puppeteer configuration instead:

```ts
puppeteerOptions: {
  connect: {
    browserURL: 'http://127.0.0.1:9222';
  }
}
```

Raw `puppeteerOptions.connect` cannot be combined with high-level `browser.mode`, `browser.channel`, or `browser.remoteDebuggingTimeout` settings.

## Troubleshoot the connection

| Problem                                        | What to check                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Approval times out                             | Remote debugging is enabled, Chrome is open, and the prompt was approved before the configured timeout.       |
| Wrong Chrome opens or no browser is found      | `browser.channel` matches the Chrome channel in which remote debugging was enabled.                           |
| Sahne reports an unsupported Puppeteer version | Upgrade Puppeteer to 24.32.0 or newer, or use `--browser=launch`.                                             |
| `auto` launches instead of connecting          | The process is non-interactive, `CI` is truthy, or the installed Puppeteer is too old for channel discovery.  |
| The page title changed                         | Keep the title marker, or configure `browser.indicator: 'none'`.                                              |
| Authentication is missing                      | Confirm Sahne connected to the intended Chrome channel and profile rather than launching an isolated browser. |

If connection is optional, use `auto`. If isolation is preferable, use [`launch`](./browser-modes.md#isolated-launch).
