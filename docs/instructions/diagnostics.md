# flemo diagnostics reference

Use this reference when instrumenting a device session. Per-browser decisions are resolved in `packages/core/src/platform/profile.ts` and pinned by `platformDefaults.test.ts`.

1. [Start with the flight recorder](diagnostics/flight-recorder.md) before changing anything; check retired flags, residue, and evidence sources.
2. [Use the E2E helpers and validation rules](diagnostics/e2e.md).
3. [Apply the observation checklist](diagnostics/observation.md) before judging motion.
