# Transition recorder, residue, and retired diagnostics

## Start with the transition recorder

Attach `@flemo/devtools` before changing anything, then reproduce once. Use `/playground?devtools=on` in the playground. `window.flemo.report()` returns the driver tier, A/B residue, observation trustworthiness, and known 2026 defect classes.

Read these sections carefully:

- `transitions[].motion` reports pose advancement, not merely frame arrival. Release races, hold re-assertions, and freeze-then-leap defects can keep the screen stationary despite clean frame timing.
- `judgingProtocol` requires DevTools closed, no capture, and real input. The page cannot verify these conditions; a clean report collected with DevTools open is not evidence.

## Retired `flemo:*` engine flags

Core reads no `flemo:*` storage key. All 24 former keys and their registry were removed on 2026-08-31 because diagnostic instruments and documentation should not ship in consumer bundles. Each former override is now a computed default.

Per-browser behavior did not change: consumers never set these keys. Comparing alternative behavior now requires building the branch implementing it; consider that cost before restoring an override.

Only `@flemo/devtools` owns active keys: `flemo:devtools` arms the recorder, and `flemo:devtools-panel-height` stores panel height. The package is installed only as a devDependency.

### Residual-toggle hazard

Session toggles outlive A/B tests: mobile tab restoration can preserve `sessionStorage` for days. Two incidents demonstrate the risk:

- A lingering `?snap=off` caused weeks of false “shimmer is back” reports; its badge was visible in the user's recording.
- A legacy `flemo:lat` seed silently defeated a newer build's pessimistic branch.

Former engine keys are inert, but devtools enumerates them so they are not mistaken for active causes. For every regression report, first read `overrides.warnings` for each key's retirement note.

## Inspect residue

Inspect stored keys with `Object.entries(sessionStorage).filter(([k]) => k.startsWith("flemo:"))` or the recorder report. No discovered engine key can affect transition behavior; treat it as archaeology, clear it, and continue.

## Retired `window.__flemo*` globals

`window.__flemoPlayerGaps` mirrored the rAF motion player's frame gaps. Both the global and `transitionPlayer.ts` were removed when the player was retired. Nothing replaced them: a compiled transition has no main-thread clock to read. Frame evidence now comes from a recording or screenshot-energy probe, not a global.
