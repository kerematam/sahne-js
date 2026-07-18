# Effect v4 Development Reference

Status: current.

## Version Contract

- Effect version: `4.0.0-beta.97`
- Source tag: `effect@4.0.0-beta.97`
- Source commit: `f643dbb265093065dc0a61ca6133693dc2401678`
- Source repository: `https://github.com/Effect-TS/effect`
- Local checkout: `.repos/effect`

The package dependency and source checkout must stay on the same exact beta.
Effect v4 is still changing, so do not research against a floating `main`
checkout after selecting a package version.

## Documentation Policy

Do not copy Effect guides or install an Effect-specific project skill. The
pinned checkout already contains the version-matched documentation, source,
examples, and tests needed to work with Effect.

## Authority Order

1. `LLMS.md` and `ai-docs/src/` for current guidance and examples
2. `packages/*/src/` for exact public APIs and JSDoc
3. Package tests and type tests for runtime and inference behavior

Use `effect.website` only for conceptual background. Its public examples may
target Effect v3 and must be checked against the pinned v4 source.

## Initial Checkout

Run from the SahneJS repository root:

```bash
mkdir -p .repos
git clone --depth 1 --single-branch --branch effect@4.0.0-beta.97 \
  https://github.com/Effect-TS/effect.git .repos/effect
```

The checkout is gitignored and read-only.

## Pin an Existing Checkout

```bash
git -C .repos/effect remote set-url origin https://github.com/Effect-TS/effect.git
git -C .repos/effect fetch --depth 1 origin tag effect@4.0.0-beta.97
git -C .repos/effect checkout --detach effect@4.0.0-beta.97
```

Do not edit or import from `.repos/effect`.

## Install the Matching Package

```bash
npm install effect@4.0.0-beta.97 --workspace sahne-js
```

Add other `@effect/*` packages only when required, using the same exact version.

## Verify Alignment

```bash
node -p 'require("./packages/sahne/package.json").dependencies.effect'
node -p 'require("./.repos/effect/packages/effect/package.json").version'
git -C .repos/effect tag --points-at HEAD --list effect@4.0.0-beta.97
git -C .repos/effect rev-parse --is-shallow-repository
```

Expected version signals are `4.0.0-beta.97` and
`effect@4.0.0-beta.97`; the checkout must report `true` for shallow history.

When upgrading, change the package dependency, source tag, and this document in
the same change.
