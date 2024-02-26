const config = {
  sourceOrigin: "http://127.0.0.1:5173",
  targetOrigin: "http://127.0.0.1:8080",
  interceptor: {
    preHandling: async (request) => {
      if (request.url().includes("bundle.js")) {
        request.respond({ body: fs.readFileSync(filePath) });
      }
    },
    beforeRequest: async (request) => {},
    afterResponse: async (request, response) => {},
  },
};

export default config;
