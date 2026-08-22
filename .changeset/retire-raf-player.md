---
"@flemo/core": minor
"@flemo/react": patch
"@flemo/devtools": minor
---

Retire the rAF motion player. Every browser flemo supports already ran the compiled
compositor tier — Blink, desktop Safari and touch WebKit were each routed there
unconditionally — so the second driver, its landing pixel-snap, its kind classifier, the
driver policy and eight diagnostic flags (`flemo:motion-driver`, `-force`,
`landing-snap`, `handoff`, `handoffms`, `apply`, `snap`, `snapband`) are gone. Authored
`driver: "player"` pins are no longer accepted; `driver: "native"` keeps its meaning
(opt into clock surgery for that transition). `@flemo/core` drops 2.8 KB gzipped.

Devtools reports lose the `driverPolicy` section and instead list retired `flemo:*` keys
still persisted on a device, marked as inert, so residue is ruled out rather than chased.
