import { resolve } from "path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  // Keep `process.env.NODE_ENV` as an EXPRESSION in the published bundle
  // instead of letting Vite fold it to "production" at library-build time.
  // The development diagnostics (see utils/devDiagnostics) must be decided by
  // the CONSUMER's bundler — folding it here would ship a library that can
  // never warn, in anyone's dev server.
  define: {
    "process.env.NODE_ENV": "process.env.NODE_ENV"
  },
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
