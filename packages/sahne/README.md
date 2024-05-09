# SahneJS

SahneJs is a tool that can be used for mocking, testing, and debugging by intercepting and manipulating certain requests. It uses Puppeteer's interceptor to redirect specific requests for manipulation. You can direct these requests to an internal development server from any URL, or read them from a local file you specify.

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
import { defineConfig } from 'sahne-js';

export default defineConfig({
  // initial URL to visit on load
  initialUrl: 'https://your-prod-site.com/home-page',
  interceptor: [
    {
      match: ({ href }) => href.startsWith('https://your-prod-site.com'),
      proxy: 'http://localhost:5173',
      ignore: 'https://your-prod-site.com/api/**'
    }
  ]
});
```

For CommonJS:

```js
const { defineConfig } = require('sahne-js');

module.exports = defineConfig({
  // initial URL to visit on load
  initialUrl: 'https://your-prod-site.com/home-page',
  interceptor: [
    {
      match: ({ href }) => href.startsWith('https://your-prod-site.com'),
      proxy: 'http://localhost:5173', // dev server URL
      ignore: 'https://your-prod-site.com/api/**'
    }
  ]
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
// vite.config.js: https://vitejs.dev/config/
export default defineConfig({
  // ...
  server: {
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      clientPort: 5173
    }
  }
});
```
