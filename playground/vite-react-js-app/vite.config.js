import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "127.0.0.1",
      // server: "0.0.0.0",
      clientPort: "5173",
    },
  },
  // INFO: Uncomment this while building for testing
  // build: {
  //   outDir: "dist-for-testing",
  // },
});
