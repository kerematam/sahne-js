---
title: CLI reference
description: Sahne command syntax, flags, environment variables, configuration loading, and exit behavior.
---

# CLI reference

The `sahne-js` package installs the `sahne` executable.

```sh
npx sahne [flags]
```

## Browser mode

```text
--browser <auto|remote-debugging|launch>
```

Overrides `SAHNE_BROWSER_MODE` and `browser.mode` for the current run.

```sh
npx sahne --browser=launch
npx sahne --browser=remote-debugging
```

See [Browser modes](../guide/browser-modes.md) for the behavior of each value.

## File

```text
--file <path>
-f <path>
```

Loads a configuration file other than `sahne.config.ts` in the current working directory.

```sh
npx sahne --file sahne.config.preview.ts
npx sahne -f ./config/customer-a.ts
```

The path is resolved from the current working directory. The loaded module can use a default export or export the configuration object directly.

## Help and version

| Flag                    | Description                        |
| ----------------------- | ---------------------------------- |
| `--help`, `-h`          | Show command usage and flags.      |
| `--version`, `-v`, `-V` | Print the installed Sahne version. |

```sh
npx sahne --help
npx sahne --version
```

## Shell completions

```text
--completions <bash|zsh|fish|sh>
```

Prints a completion script for the selected shell to stdout.

```sh
npx sahne --completions zsh
```

Follow your shell's conventions to install or source the printed script.

## Log level

```text
--log-level <all|trace|debug|info|warn|warning|error|fatal|none>
```

Sets the minimum Effect log level for this run.

```sh
npx sahne --log-level warn
```

Use `info` when diagnosing rule decisions; Sahne's successful proxy, file, ignore, and next messages are emitted at that level.

## Environment

### `SAHNE_BROWSER_MODE`

Sets the browser mode when the CLI flag is absent:

```sh
SAHNE_BROWSER_MODE=launch npx sahne
```

Accepted values are `auto`, `remote-debugging`, and `launch`. An empty value is treated as unset; any other value fails configuration.

### `CI`

`auto` uses the `CI` environment variable together with terminal detection. A non-empty value other than `0`, `false`, `no`, or `off` makes the environment non-interactive and selects launch mode.

## Exit and cleanup

The CLI remains active while its browser session is active. Press Ctrl+C or send SIGTERM for graceful cleanup.

- Launched browsers are closed.
- Connected browsers remain open and the Puppeteer client disconnects.
- The connected managed tab is closed by default.
- Request listeners are removed and in-flight handlers are interrupted.

Missing, invalid, or unloadable configurations are printed to stderr and exit with status `1`.
