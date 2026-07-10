# Effect Source Reference

Status: Current reference.
Last verified: July 10, 2026.

This repository keeps a local checkout of the Effect v4 source at
`.repos/effect`. It is read-only research material for agents and developers.
Application code must import Effect from declared package dependencies, never
from the local checkout.

## Source Repository

Use the Effect v4 beta source:

```text
https://github.com/Effect-TS/effect-smol
```

Do not use `https://github.com/Effect-TS/effect` for this migration. That
repository is the Effect v3 line, while SahneJS is targeting Effect v4 beta.

## Local Checkout Shape

- Path: `.repos/effect`
- Remote: `https://github.com/Effect-TS/effect-smol`
- Branch: `main`
- History: shallow clone with `--depth 1`
- Usage: read-only reference for APIs, tests, examples, and patterns

The checkout is intentionally gitignored and must not be committed.

## Initial Checkout

Run from the SahneJS repository root when `.repos/effect` is missing:

```bash
mkdir -p .repos
git clone --depth 1 --single-branch --branch main https://github.com/Effect-TS/effect-smol .repos/effect
```

## Refresh Existing Checkout

Run from the repository root to replace the local reference with the latest
`main` revision while keeping the checkout shallow:

```bash
git -C .repos/effect fetch --depth 1 origin main
git -C .repos/effect checkout main
git -C .repos/effect reset --hard origin/main
git -C .repos/effect clean -fd
git -C .repos/effect gc --prune=now
```

These commands discard local edits inside `.repos/effect`. That is expected
because the checkout is reference material, not application code.

## Verify

```bash
git -C .repos/effect rev-parse --is-shallow-repository
git -C .repos/effect remote -v
sed -n '1,24p' .repos/effect/packages/effect/package.json
```

Expected signals:

- `rev-parse --is-shallow-repository` prints `true`.
- `origin` points to `https://github.com/Effect-TS/effect-smol`.
- `.repos/effect/packages/effect/package.json` has a `4.0.0-beta.*` version.
