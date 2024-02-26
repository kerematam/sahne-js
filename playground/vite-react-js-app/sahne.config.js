import { defineSahneConfig } from "sahne";

export default defineSahneConfig({
  initialUrl: "http://localhost:8080",
  interceptor: [
    {
      target: "http://localhost:8080",
      proxyTarget: "http://localhost:5173",
    },
    // {
    //   target: "http://localhost:8080/test",
    //   proxyTarget: "https://jsonplaceholder.typicode.com/todos/1",
    // },
  ],
});
