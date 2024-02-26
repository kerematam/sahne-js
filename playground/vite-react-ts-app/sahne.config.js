// @ts-check
import { defineSahneConfig } from "sahne";

const target = "http://localhost:8080";

export default defineSahneConfig({
  initialUrl: target,
  interceptor: [
    {
      target: target,
      proxyTarget: "http://localhost:5173",
      ignoreRequest: (req) => req.url().startsWith(`${target}/mock-api`),
    },
    // {
    //   target: "http://localhost:8080/mock-api/test.json",
    //   proxyTarget: "https://jsonplaceholder.typicode.com/todos/1",
    // },
  ],
});
