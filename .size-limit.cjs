// Bundle-size budgets for the published @flemo/* packages, enforced on every
// PR via .github/workflows/size.yml. Numbers are gzipped sizes; pick budgets
// that leave ~20-30% headroom from the current baseline so deliberate growth
// can land but accidental balloon (a stray import of all-of-motion, etc.)
// trips immediately.
module.exports = [
  {
    name: "@flemo/core",
    path: "packages/core/dist/index.mjs",
    // Measured with all dependencies bundled (zustand + path-to-regexp) —
    // the real wire cost for a fresh consumer.
    //
    // What the number covers: the navigation/task/history/store core, the
    // compiled-style engine and its per-platform head kits, the flight's
    // glass-integrity machinery (arrival/response/image/layer holds, the
    // perceptual completion cut), the swipe controller, the
    // compositor warm-up and the GPU pipeline prewarm.
    //
    // History worth keeping, because it is the shape of the budget: the
    // device campaigns of 2026-08 took it 22.4 -> 25.3 -> 31.9 -> 36.9 KB,
    // each step device-justified. Two removals then gave most of it back —
    // the rAF motion driver (-2.8 KB) and the image decode offloader with its
    // embedded worker source (-2.7 KB) — landing at 32 KB.
    // Re-based to 35 KB with ~9% headroom so the gate still trips on a
    // multi-KB balloon.
    limit: "35 KB",
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
  },
  // @flemo/devtools ships two independent entry points out of one bundle, so
  // it is budgeted per named export (`import` makes size-limit tree-shake the
  // entry down to that export's reachable graph) rather than per file. The
  // split exists because the two are adopted separately: a consumer wiring up
  // the recorder for a bug report must not pay for the visual panel, and the
  // panel's growth must not eat the recorder's headroom.
  {
    name: "@flemo/devtools (recorder)",
    path: "packages/devtools/dist/index.mjs",
    import: "{ attachFlightRecorder }",
    // Zero-dependency flight recorder (~8 KB at birth: report schema
    // constants, flag registry, anomaly derivation, recorder). The regression
    // net — pose/clock progress sampling, hold re-assert detection, the
    // orphaned-hold and mid-flight image audits, and the judging protocol —
    // took it to 9.2 KB, which is deliberate: those are the signatures the
    // 2026-08 campaign's defects would return through. Re-based to 12 KB so
    // the ~25% headroom convention holds again; a dependency creeping in
    // would still blow straight through it.
    limit: "12 KB",
    gzip: true
  },
  {
    name: "@flemo/devtools (panel)",
    path: "packages/devtools/dist/index.mjs",
    import: "{ attachDevtoolsPanel }",
    // The visual panel: shadow-root shell, stylesheet, flight list/detail
    // renderers — PLUS the recorder, which the panel falls back to attaching
    // itself, so this number is the real cost of `attachDevtoolsPanel` alone
    // (measured 13.5 KB, of which ~9 KB is the shared recorder). Budgeted
    // with ~25% headroom; this is a dev-only surface, but it is still shipped
    // code and a stray charting dependency should trip the gate.
    limit: "17 KB",
    gzip: true
  }
];
