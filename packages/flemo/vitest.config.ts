import { resolve } from "path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
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
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"]
  }
});
