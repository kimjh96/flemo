# Hold and park before release

During render, the binding computes `holdKey` through `screen/animStartAnchor.ts` and stamps `data-flemo-anim-hold` on the scope, shared bars, and decorator in the status-changing commit. `ANIM_HOLD_RULE` applies `animation-play-state: paused !important`; `fill: both` preserves the `from` pose. This prevents iOS WebKit from aging a CSS animation while a heavy first frame remains unpresented.

`ScreenMotion.holdAttr` values:

| Value | Behavior and requirements |
| --- | --- |
| `"true"` | Pauses at the `from` pose. |
| `"park"` | Places a COVERED passive pop destination at its destination pose for hold-time rasterization. Requires a verifiably opaque covering background from the `ScreenSurface` registry. |
| `"park-under"` | Places an ACTIVE push or replace entrant at its destination beneath the previous screen, with `zIndex: -1` on the outer container. Requires opaque cover. Withhold the entering initial inline style while parked because it would override the park rule. |
| `"park-over"` | Places the destination pose above the prior screen at `opacity: 0.02` to raster entering tiles before flight. Computed default for touch WebKit (`parkOver` in `platform/profile.ts`). |

`scheduleAnimHoldRelease` and `createAnimHoldCoordinator` provide double-rAF scheduling, image-decode readiness, and a pop-pair barrier that releases both screens on one clock.

The optional render-settle gate is default-on for touch WebKit, touch Blink, and the steady-60 desktop profile through `readSettleGateFlag()`. It waits only for entering-screen render commits to quiesce, never for data: `firstWaitMs` 120, `capMs` 700, `graceMs` 60, and `renderSettleOnly: true`.

The gate runs on every engine for the active PUSHING or POPPING side and the INACTIVE returning pop screen. The returning side uses `minNodes: 1`; the active side uses 30. REPLACING is ungated. The gate protects only flight start: a block during a compiled flight still ages its wall clock.

For non-Blink, authored `driver:"native"` pins, and governed-compiled touch WebKit, the release callback writes `data-flemo-anim-hold="false"` directly in the readiness rAF and clears the `park-under` z-index in that frame, making clock anchoring and first paint atomic.
