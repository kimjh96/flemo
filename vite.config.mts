import { resolve } from "path";

import react from "@vitejs/plugin-react";
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
      external: /^(react|react-dom|motion)(\/|$)/
    }
  },
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"]
      }
    }),
    dts()
  ],
  resolve: {
    alias: [
      "core",
      "history",
      "navigate",
      "renderer",
      "screen",
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
