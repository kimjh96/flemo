import path from "node:path";
import { resolve } from "path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts"
    },
    rollupOptions: {
      external: (id) => {
        if (id.startsWith(".") || path.isAbsolute(id)) return false;

        return /^(react|react-dom|motion)(\/|$)/.test(id);
      },
      output: [
        {
          interop: "auto",
          format: "es",
          banner: (_) => "",
          manualChunks: (id) => {
            if (id.indexOf("node_modules") !== -1) {
              return "vendor";
            }

            return null;
          },
          entryFileNames: "[name].mjs"
        }
      ]
    }
  },
  plugins: [react(), dts()],
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
