// Bundle-size budgets for the published @flemo/* packages, enforced on every
// PR via .github/workflows/size.yml. Numbers are gzipped sizes; pick budgets
// that leave ~20-30% headroom from the current baseline so deliberate growth
// can land but accidental balloon (a stray import of all-of-motion, etc.)
// trips immediately.
module.exports = [
  {
    name: "@flemo/core",
    path: "packages/core/dist/index.mjs",
    // Measured with all dependencies bundled (zustand + path-to-regexp).
    // That's the real wire cost for a fresh consumer. ~11.2 KB current — the
    // framework-neutral engine (lifecycle, swipe, bar-riding, screen store,
    // navigation controller, popstate bridge) now lives here, moved out of
    // @flemo/react.
    limit: "13 KB",
    gzip: true
  },
  {
    name: "@flemo/react",
    path: "packages/react/dist/index.mjs",
    // ~6.2 KB current — a thin binding now that the transition logic moved to
    // @flemo/core. Tightened from 12 KB to lock in the shrink and trip on an
    // accidental balloon back.
    limit: "8 KB",
    gzip: true,
    // peers + workspace dep, already excluded by Vite externals, but list
    // them here too so size-limit doesn't try to resolve and bundle them
    // when introspecting.
    ignore: ["react", "react-dom", "@flemo/core"]
  },
  {
    name: "@flemo/react-layout",
    path: "packages/react-layout/dist/index.mjs",
    limit: "1 KB",
    gzip: true,
    ignore: ["react", "react-dom", "motion", "@flemo/core", "@flemo/react"]
  }
];
