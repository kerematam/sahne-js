// @ts-check
const { defineSahneConfig } = require("sahne");

const target = "http://localhost:8080";

module.exports = defineSahneConfig({
  initialUrl: target,
  interceptor: [
    {
      target: target,
      proxyTarget: "http://localhost:3000",
      ignoreRequest: (req) => req.url().startsWith(`${target}/mock-api`),
    },
  ],
});
