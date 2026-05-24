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
      external: /^(react|react-dom|motion|@flemo\/(core|react))(\/|$)/
    }
  },
  plugins: [react(), dts()]
});
