# Repository Guidance

- Treat `V2_MIGRATION.md` as the behavioral and toolchain baseline for the planned Effect v4 migration.
- Preserve the published API, CLI behavior, interception semantics, and Node.js support contract unless the user explicitly asks for a breaking change.
- Keep the core package runtime-neutral within its Node.js contract; do not couple it to playground or test-fixture implementation details.

## Where To Look

- `V2_MIGRATION.md`
  Records the v2 release contract, breaking changes, and completed validation.
- `packages/sahne/src/`
  Maintained SahneJS library and CLI implementation.
- `packages/sahne/package.json`
  Published package metadata, dependency boundary, exports, and runtime requirements.
- `tests/sahne-app/`
  Browser integration fixture and interceptor API tests.
- `playground/vite-react-ts-app/`
  Maintained Vite playground used for manual and integration flows.

## Effect v4 Guidance

- Use the project-local `effect-ts` skill in `.agents/skills/effect-ts` for all Effect-related planning, implementation, review, and testing.
- This migration targets Effect v4 beta. Treat Effect v3 examples and APIs as incompatible until verified against the local v4 guides or source.
- Read the relevant skill guide first, then inspect existing SahneJS patterns, and use `.repos/effect` for source-level confirmation when needed.
- Add Effect packages only when the migration step needs them, and keep `effect` and all `@effect/*` packages version-aligned.

## Effect Source Reference

- Effect v4 source is available locally at `.repos/effect` for researching APIs, tests, patterns, and examples.
- The checkout must come from `https://github.com/Effect-TS/effect-smol`; the separate `Effect-TS/effect` repository is the Effect v3 line.
- Treat `.repos/effect` as read-only reference material. Never import from it; application code must import from declared package dependencies.
- Keep the checkout shallow (`--depth 1`) and gitignored.
- Use `docs/effect-source.md` to create, refresh, and verify the checkout.
