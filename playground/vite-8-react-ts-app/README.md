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

Use separate terminals from this directory:

```sh
npm run dev
npm run build && npm run preview
npm run sahne
```

- Vite development server: `http://localhost:5173`
- Vite preview target: `http://localhost:4173`
- HMR WebSocket: `ws://localhost:5173`
