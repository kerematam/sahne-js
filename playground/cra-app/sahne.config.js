// @ts-check
const { defineConfig } = require("sahne-js");

const target = "http://localhost:8080";

module.exports = defineConfig({
  initialUrl: target,
  interceptor: [
    {
			match: 'http://localhost:4173/**',
			ignore: '/mock-api/*',
			proxyOrigin: 'http://localhost:5173'
    },
  ],
});
