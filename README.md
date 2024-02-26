# SahneJS

Sahne is a tool designed for testing and debugging. It uses Puppeteer's interceptor to implement a reverse proxy, allowing for local request manipulation within the browser.


https://github.com/kerematam/sahne-js/assets/5495509/1f6dd509-6feb-4730-9603-6e6ee6161a5b



## Installation

To install `SahneJS`, run the following command:
```sh
# Puppeteer is peer dependency
npm install --save-dev puppeteer sahne-js
```

A common scenario with SPA applications involves injecting development bundles into production bundles. Configurations should be provided through sahne.config.js, which is created in the root path of the project directory:

```js
// sahne.config.js, lets you easy access to types
import { defineSahneConfig } from "sahne";

// or with CommonJs
// const { defineSahneConfig } = require("sahne")

export default defineSahneConfig({
  // initial URL to visit on load
  initialUrl: "https://your-prod-site.com/home-page",
  interceptor: [
    {
      matchTarget: "https://your-prod-site.com", // URLs start with this will match
      proxyTarget: "http://localhost:5173", // dev server URL
      ignoreRequest: (req) => req.url().startWith("https://your-prod-site.com/api")
    },
  ],
});
```
You may trigger the tool with below command. Ensure that proxy server is running.
```sh
# Initilize the tool:
# Caveat(!): Your dev server (proxyURL) should be running
npx sahne
```

To be able to use with HMR in Vite, you need to expose HMR socket seperately to escape target domain:

```js
// https://vitejs.dev/config/
export default defineConfig({
  // ...
  server: {
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "127.0.0.1",
      clientPort: 5173,
    },
  },
});
```
