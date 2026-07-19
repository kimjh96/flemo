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
    // That's the real wire cost for a fresh consumer. On top of the
    // framework-neutral engine (lifecycle, swipe, bar-riding, screen store,
    // navigation controller, popstate bridge), core now also carries the rAF
    // motion engine (transition player, driver policy, cubic-bezier solver,
    // variant motion) and the in-flight glass-integrity machinery (commit
    // hold, perceptual completion cut) — the latter pushed the local ruler to
    // ~22.3 KB, a deliberate +0.6 KB for measured judder mechanisms. The
    // pose-preserving quarantine, opening-clock guard, and learned
    // mount-cost policy (tap-freeze deferral) added another deliberate
    // ~1.7 KB of measured-defect machinery, putting the local ruler at
    // ~24.2 KB. Baselines still differ by toolchain (~19.4 KB by CI's
    // size-limit run vs ~24.2 KB locally on a byte-identical dist, cause
    // unresolved) — the budget leaves headroom above the LARGER ruler so the
    // gate can't flap across environments while still tripping on a multi-KB
    // accidental balloon.
    limit: "26 KB",
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
