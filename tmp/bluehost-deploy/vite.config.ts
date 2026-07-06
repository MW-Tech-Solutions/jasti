import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Site served at subdomain root (https://ajasti.pasacouncil.org/).
  base: process.env.VITE_APP_BASE_PATH || "/",
  build: {
    rollupOptions: {
      output: {
        // Use content hashes so each deploy gets fresh asset URLs.
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/ajasti/api": {
        target: "http://localhost",
        changeOrigin: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
