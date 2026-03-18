import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { mochaPlugins } from "@getmocha/vite-plugins";

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [...mochaPlugins(process.env as any), react(), cloudflare({ persistState: { path: ".mf" } })],
  server: {
    allowedHosts: true,
    // allow binding to all network interfaces for LAN access
    host: true,
    // Hide the HMR runtime overlay to avoid blocking dev while external fetches are investigated.
    hmr: { overlay: false },
  },
  build: {
    chunkSizeWarningLimit: 5000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
