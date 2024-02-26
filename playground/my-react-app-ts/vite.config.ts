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
      clientPort: 5173,
    },
  },
  build: {
    outDir: "dist-for-testing",
  },
});
