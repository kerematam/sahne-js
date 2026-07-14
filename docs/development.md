# Development

## Test a Local Tarball

The publishable package is the `packages/sahne` workspace, not the repository
root. Build and pack it from the repository root:

```sh
npm run pack:sahne-js
```

This creates a versioned `sahne-js-VERSION.tgz` archive in the repository root.
Replace `VERSION` below with the emitted package version, then install that
archive in the playground or another local consumer:

```sh
cd playground/vite-8-react-ts-app
npm install ../../sahne-js-VERSION.tgz
```

Running bare `npm pack` at the repository root is intentionally rejected. It
would package the private monorepo instead of the publishable `sahne-js`
workspace.

Run the clean consumer smoke test when changing package metadata, exports,
dependencies, declarations, or the CLI binary:

```sh
npm run test:pack
```
