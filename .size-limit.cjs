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
    // perceptual completion cut), the swipe controller, the image decode
    // offloader (with its embedded worker source), the compositor warm-up and
    // the GPU pipeline prewarm.
    //
    // History worth keeping, because it is the shape of the budget: the
    // device campaigns of 2026-08 took it 22.4 -> 25.3 -> 31.9 -> 36.9 KB,
    // each step device-justified. Retiring the rAF motion driver (2026-08-22
    // — the player, its landing pixel-snap, the kind classifier, the driver
    // policy and five diagnostic flags) gave 2.8 KB back, to 34.1 KB, and the
    // 37 KB re-base after it was fully spent again by 2026-08-23 (36.98 kB, 16
    // bytes of headroom — the gate was one commit from tripping on anything).
    //
    // Internalizing shared-element morphs (2026-08-25) took it to 45.0 kB:
    // the pairing, the measured travel, the per-flight keyframe compiler, the
    // paint-channel table, the stand-in and the gesture handle, which used to
    // be `motion` in a consumer's node_modules and are now flemo's own. That
    // is a whole feature's worth of growth and it is measured separately
    // below, so the next KB has to say which half it came from.
    limit: "48 KB",
    gzip: true
  },
  // The morph runtime, measured as its own reachable graph. It is a real
  // split, not bookkeeping: `<Morph>` is the only thing that pulls this in, so
  // an app that ships no shared element tree-shakes every byte of it, and the
  // number above is the ceiling rather than the bill. Budgeting it separately
  // is what keeps morph growth from quietly eating the engine's headroom —
  // the same reason the devtools entries are split below.
  {
    name: "@flemo/core (morph)",
    path: "packages/core/dist/index.mjs",
    import: "{ attachMorph, beginMorphSwipe, registerMorphLayer, createMorphTransition }",
    // 15.6 kB at birth, including what it shares with the engine (the easing
    // solver, the style compiler's declaration writer). ~15% headroom.
    limit: "18 KB",
    gzip: true
  },
  {
    name: "@flemo/react",
    path: "packages/react/dist/index.mjs",
    // ~6.2 KB when the transition logic moved to @flemo/core, tightened to
    // 8 KB to lock that shrink in. `<Morph>` and its flight layer put it at
    // 8.0 kB — twenty lines of binding plus the layer a Router renders, since
    // everything else about a morph is core's. Re-based to 9 KB.
    limit: "9 KB",
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
