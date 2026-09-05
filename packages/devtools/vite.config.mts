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
// Four entries, built one pass each: the framework-free recorder, its inert
// production twin, the React component, and ITS inert production twin. The
// React pair externalizes `react`; the other two import nothing at all.
const ENTRIES = ["index", "noop", "react", "reactNoop"] as const;
const requested = process.env.DEVTOOLS_ENTRY ?? "index";
const entry = (ENTRIES as readonly string[]).includes(requested) ? requested : "index";
const isReact = entry.startsWith("react");

export default defineConfig({
  build: {
    // NEVER, for any pass. Four entries share this directory, and in WATCH
    // mode they run at the same time: a pass that emptied the directory would
    // delete siblings that had just been written, which is exactly how
    // `dist/react.mjs` went missing under `turbo run dev` and the site stopped
    // resolving `@flemo/devtools/react`. The one-shot build clears the
    // directory itself before the first pass (see package.json).
    emptyOutDir: false,
    lib: {
      entry: `./src/${entry}.ts`,
      formats: ["es"],
      fileName: () => `${entry}.mjs`
    },
    // React stays the consumer's, which is what a peer dependency means. The
    // production twin imports it not at all, so externalizing is a no-op there
    // and costs nothing to state once.
    rollupOptions: isReact ? { external: ["react"] } : {}
  },
  // Declarations come from the first pass only; the others would rewrite the
  // same files from the same sources.
  plugins: entry === "index" ? [dts()] : []
});
