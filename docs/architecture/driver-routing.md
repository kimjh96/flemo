# Flight routing: which opening a flight gets

Based on `core/engine/flightRouting.ts` and the platform predicates it reads.

Every flight uses the compiled CSS animation; there is no driver selection. The rAF motion player, demotion strike machinery, `driver: "player"` pin, and entire `flemo:*` override surface were retired (`f32c2cc`, `28d0377`, `47332c9`, `2be1e05`). Descriptions of a choice between two driver tiers are obsolete.

`resolveFlightRouting` determines the opening treatment and whether the engine may touch the flight's clock, given the browser, navigation status, and authored transition options. It runs once per drive run and reads probes live, so a verdict formed mid-session applies on the next navigation.

## Inputs

| Input | Meaning |
| --- | --- |
| `status` | `PUSHING` / `POPPING` / `REPLACING` / `COMPLETED` / `IDLE` |
| `transition` | Authored transition; read only for `driver: "native"` |
| `skipAnimation` | Scope carries the skip marker for this flight |
| `hasActiveMotion` | Active variant resolves a motion |
| `hasAnimation` | Active variant has any authored animation |

## Outputs

| Field | Condition or value | Effect |
| --- | --- | --- |
| `hasDrivableMotion` | Not skipped and active variant resolves a motion | Motion exists to drive |
| `nativeSurgeryAllowed` | `driver: "native"` and not Blink | Allows holding, anchoring, and re-anchoring the flight's clock |
| `touchGoverned` | Non-Blink and touch | Enables the governed compiled tier |
| `forceCompiled` | Non-Blink and touch, with `POPPING` or with `PUSHING` and the settle gate on | Disables wall-clock accelerators |
| `governedHead` | `touchGoverned`, legacy Android Blink, or `forceCompiled` | Bakes a flat opening segment into keyframes |
| `desktopHead` | Desktop macOS Safari | Uses that tier's flat head, lengths, and gate attribute |
| `birthHoldMs` | Head-length table below | Sets the flat head's hold duration |
| `governedSlide` | `touchGoverned` and either `PUSHING` or `POPPING` | Disables wall-clock accelerators for a slide |
| `framePacingKeepalive` | Has an animation, is Blink, and is desktop or has a measured high-refresh cadence | Keeps a frame source alive for even Chrome presentation pacing |
| `creepHead` | `governedHead` on the governed tier | Adds a translateZ hair to the head's end keyframe so its value changes across the head |

Head lengths in milliseconds:

| Kit | REPLACING | PUSHING | POPPING |
| --- | ---: | ---: | ---: |
| Governed (`GOVERNED_HEAD_MS`) | 180 | 100 | 80 |
| Desktop macOS Safari (`DESKTOP_HEAD_MS`) | 33 | 33 | 17 |

Desktop lengths derive from a 60Hz pipeline: two frames for entry and one for pop, independently of the governed table. Arming the desktop head retires the birth anchor to avoid two interventions on one clock—the pairing the touch tier was built to avoid.

## Clock surgery is opt in

`nativeSurgeryAllowed` is the only field an author can change and is off by default. First-frame holding, flight-start anchoring, and stall re-anchoring mutate a running animation's timing. The 2026-08 iPhone falsification series established that any such timing touch on WebKit costs the accelerated out-of-process path or desynchronizes its re-sync.

By default, the compiled animation runs untouched, with release scheduling protecting its opening. `driver: "native"` knowingly accepts the main-thread-presentation tradeoff; it never permits clock surgery on Blink.

## Shared head kit

`resolveHeadKit(status)` is a pure function of platform and status, independent of the flight. The morph runtime needs this answer before it can reliably read it from the DOM.

The engine writes the head's root attribute in the same commit that stages a morph, but React runs descendant layout effects first. A morph reading that attribute therefore sees the previous flight's answer: correct by luck from the second navigation onward, but wrong on the first. This caused an element on the first push to run 33ms ahead of its screen while later pushes aligned.

## Predicates

| Predicate | Source or rule |
| --- | --- |
| `detectBlinkEngine()` | `@platform/engineProbes` |
| Touch | `navigator.maxTouchPoints > 0`; no navigator means no touch surface |
| `governedCompiledActive()` | Non-Blink and touch (`@platform/governedCompiled`) |
| `isLegacyAndroidBlink()` | No UA-CH brands, indicating confidently pre-2021 hardware |
| `isDesktopMacWebKit()` | `@platform/engineProbes` |
| `settleGateActive()` | Governed compiled, steady-60 desktop Blink, touch Blink, or desktop macOS Safari |
| `learnedFrameIntervalMs()` | Measured cadence compared with `COMPILED_TIER_MAX_INTERVAL_MS` |

## Deliberately open gap

Modern but weak touch Blink devices with UA-CH present are not legacy. They previously earned the governed head kit through the now-retired demotion machinery. The render-settle gate addresses the same mount weight from the other side and is enabled by default for touch Blink.

Extending the kit to all touch Blink remains a possible next lever, but must not be done blindly: the 2026-08-14 round reverted that blanket treatment after fast devices developed the compiled landing snap.
