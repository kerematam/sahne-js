import { defineSahneConfig } from "sahne";

const target = "http://localhost:4173";

export default defineSahneConfig({
  initialUrl: target,
  interceptor: [
    {
      matchTarget: target,
      proxyTarget: "http://localhost:5173",
      ignoreRequest: (req) => req.url().startsWith(`${target}/mock-api`),
    }
  ],
});
