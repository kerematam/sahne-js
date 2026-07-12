# Vite 8 Sahne Playground

This is a clean React and TypeScript app generated with Create Vite. It uses
Vite 8's `server.ws` configuration so the HMR client connects directly to the
development server instead of the URL opened by Sahne.

## Install

The playground links directly to the `packages/sahne` workspace. Build that
package from the repository root first:

```sh
npm run build:sahne-js
```

Then run a normal install so Puppeteer's lifecycle script can install its
compatible Chrome for Testing build:

```sh
cd playground/vite-8-react-ts-app
npm install
```

If the Puppeteer package is already installed but its browser cache is missing,
install the managed browser explicitly:

```sh
npm exec puppeteer browsers install chrome
```

## Run

The playground uses `browser.mode: 'auto'`. In an interactive terminal it
connects to Chrome remote debugging; in CI or another non-interactive
environment it launches an isolated browser.

Before the interactive run, enable remote debugging in Chrome at
`chrome://inspect/#remote-debugging`. Then use separate terminals from this
directory:

```sh
npm run dev
npm run build && npm run preview
npm run sahne
```

Chrome asks you to approve Sahne's connection. To choose a mode explicitly:

```sh
npm run sahne:remote-debugging
npm run sahne:launch
```

- Vite development server: `http://localhost:5173`
- Vite preview target: `http://localhost:4173`
- HMR WebSocket: `ws://localhost:5173`

## Existing Chrome and Chrome DevTools MCP

The `auto` default and `sahne:remote-debugging` script connect Sahne to the
normal Chrome stable channel using Chrome 144+'s permission-based debugging
flow. `sahne:connect` remains an alias for the explicit remote-debugging script.

In Chrome, enable remote debugging at
`chrome://inspect/#remote-debugging`. Then use:

```sh
npm run dev
npm run build && npm run preview
npm run sahne
```

Approve Chrome's connection prompt. Puppeteer reads Chrome's
`DevToolsActivePort` file through `connect({ channel: 'chrome' })`, so the
permission-based connection needs no configured port and does not probe
`127.0.0.1:9222`. The private port does not need to expose `/json/version`.

Sahne leaves the inspect page and every other existing tab alone. It creates a
fresh tab, installs interception before navigating it to
`http://localhost:4173`, and prefixes its title with `🟢 Sahne — `. Changes
served by Vite on `5173` then appear in that clearly marked tab.

For an intentional classic CDP endpoint, configure the advanced
`puppeteerOptions.connect.browserURL` option instead of using
`remote-debugging` mode.

Chrome DevTools MCP can independently request permission for the same browser:

```json
{
  "mcpServers": {
    "sahne-playground": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@1.5.0",
        "--auto-connect",
        "--no-usage-statistics",
        "--no-performance-crux",
        "--redact-network-headers"
      ]
    }
  }
}
```

Stopping Sahne closes only its managed tab and disconnects without closing
Chrome. Closing the managed tab also ends Sahne's connected session. Select and
reuse the marked Sahne page in Chrome DevTools MCP. Tabs created independently
by MCP or the developer are not intercepted by default.

For the deliberately browser-wide behavior, set
`browser.dangerouslyEnableForAllTabs: true`; this is unsafe for authenticated or
sensitive tabs and prints a warning.

The channel-based Puppeteer connection is experimental and this playground is
validated with Puppeteer `25.3.0` and Chrome `150`.
