import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// Zero-dependency DOM library: nothing to externalize. The recorder is a pure
// consumer of the DOM surfaces @flemo/core and @flemo/react already expose
// (data attributes, window.__flemoPlayerGaps, flemo:* storage keys), so it
// deliberately imports from neither.
export default defineConfig({
  build: {
    lib: {
      entry: "./src/index.ts",
      formats: ["es"],
      fileName: (format) => (format === "es" ? "index.mjs" : "index.js")
    }
  },
  plugins: [dts()]
});
