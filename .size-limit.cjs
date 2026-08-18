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
    // fetch-overlap work added the image decode offloader (with its embedded
    // worker source), the compositor warm-up, the pending-network counter and
    // the content-settle gate — measured on-device as the difference between
    // swallowed/juddering flights and clean ones — for a deliberate +2.9 KB
    // (CI ruler: 22.4 -> 25.3 KB). Budget re-based with ~15% headroom so the
    // gate still trips on a multi-KB accidental balloon. The motion-driver
    // hardening (five review rounds: writer-scoped inline/settle leases,
    // marker-scoped choreography, method-agnostic response hold, async image
    // decode, platform-density snap defaults, slow-cadence clock) measured
    // 31.9 KB — deliberate, device-justified growth; re-based to 33 KB with
    // ~3% headroom tightened back until the next feature wave.
    // The pop-convergence round (image-reveal hold, layer settle, governed
    // touch-WebKit routing, compiled landing governor + easing, LPM
    // release-latency probing, legacy-Blink image offloader gating) measured
    // 36.9 KB — all device-verified in the final185 build. Re-based to 40 KB
    // with ~8% headroom so the gate still trips on a multi-KB balloon.
    limit: "40 KB",
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
  {
    name: "@flemo/devtools",
    path: "packages/devtools/dist/index.mjs",
    // Zero-dependency flight recorder (~8 KB at birth: report schema
    // constants, flag registry, anomaly derivation, recorder). Generous
    // headroom for anomaly-rule growth; a dependency creeping in would blow
    // straight through it.
    limit: "10 KB",
    gzip: true
  }
];
