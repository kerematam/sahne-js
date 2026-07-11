# Repository Guidance

## Where To Look

- `packages/sahne/src/` — maintained library and CLI implementation
- `packages/sahne/package.json` — published dependency and runtime contract
- `tests/sahne-app/` — browser integration fixture and interceptor API tests
- `playground/vite-8-react-ts-app/` — maintained Vite 8 playground

## Effect v4

- Keep the installed Effect packages and `.repos/effect` checkout on the exact
  version recorded in `docs/effect-source.md`.
- Use the pinned checkout's `LLMS.md`, `ai-docs`, source, and tests as the Effect
  reference. Treat `.repos/effect` as read-only and never import from it.
