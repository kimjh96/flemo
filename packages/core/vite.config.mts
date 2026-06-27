import { resolve } from "path";

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
      external: /^(zustand|path-to-regexp)(\/|$)/
    }
  },
  plugins: [dts()],
  resolve: {
    alias: ["core", "history", "navigate", "screen", "transition", "utils"].map((input) => ({
      find: `@${input}`,
      replacement: resolve(__dirname, `src/${input}`)
    }))
  }
});
