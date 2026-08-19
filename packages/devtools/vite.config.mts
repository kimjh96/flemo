import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// Zero-dependency DOM library: nothing to externalize. The recorder is a pure
// consumer of the DOM surfaces @flemo/core and @flemo/react already expose
// (data attributes, window.__flemoPlayerGaps, flemo:* storage keys), so it
// deliberately imports from neither.
// Built ONE ENTRY AT A TIME (`build` runs this config twice, see package.json)
// rather than as a two-entry lib. Rollup hoists code shared between entries
// into a sibling chunk, and each dist file must stay SELF-CONTAINED: the e2e
// suite injects dist/index.mjs into the page through a blob URL, where a
// relative `./chunk.js` import cannot resolve — and anyone loading the file
// directly (a CDN, a script tag) hits the same wall. The duplication that
// costs is a few KB in a file bundlers tree-shake anyway.
const entry = process.env.DEVTOOLS_ENTRY === "noop" ? "noop" : "index";

export default defineConfig({
  build: {
    // The second pass must not wipe the first pass's output.
    emptyOutDir: entry === "index",
    lib: {
      entry: `./src/${entry}.ts`,
      formats: ["es"],
      fileName: () => `${entry}.mjs`
    }
  },
  // Declarations come from the first pass only; the second would rewrite the
  // same files from the same sources.
  plugins: entry === "index" ? [dts()] : []
});
