import { resolve } from "path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "./src/index.ts",
      formats: ["es"],
      fileName: (format) => (format === "es" ? "index.mjs" : "index.js")
    },
    rollupOptions: {
      external: /^(react|react-dom|@flemo\/core)(\/|$)/
    }
  },
  plugins: [react(), dts()],
  resolve: {
    alias: [
      "history",
      "navigate",
      "renderer",
      "screen",
      "stores",
      "transition",
      "utils",
      "Route",
      "Router"
    ].map((input) => ({
      find: `@${input}`,
      replacement: resolve(__dirname, `src/${input}`)
    }))
  }
});
