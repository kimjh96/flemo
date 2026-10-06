# Transition routing

`resolveTransitionRouting` in `core/engine/transitionRouting.ts` determines a transition's opening treatment and whether the engine may touch its clock, using the browser, navigation status, and authored options. It runs once per drive run and reads probes live; a verdict formed mid-session applies on the next navigation.

Every transition uses compiled CSS animation. There is no driver selection: the rAF motion player, demotion strike machinery, `driver: "player"` pin, and entire `flemo:*` override surface were retired (`f32c2cc`, `28d0377`, `47332c9`, `2be1e05`). Descriptions of two driver tiers are obsolete.

## Inputs

| Input | Meaning |
| --- | --- |
| `status` | `PUSHING` / `POPPING` / `REPLACING` / `COMPLETED` / `IDLE` |
| `transition` | Authored transition; read only for `driver: "native"` |
| `skipAnimation` | Scope carries this transition's skip marker |
| `hasActiveMotion` | Active variant resolves a motion |
| `hasAnimation` | Active variant has any authored animation |

## Outputs

| Field | Condition or value | Effect |
| --- | --- | --- |
| `hasDrivableMotion` | Not skipped and active variant resolves a motion | Motion exists to drive |
| `nativeSurgeryAllowed` | `driver: "native"` and not Blink | Allows holding, anchoring, and re-anchoring the transition's clock |
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

Desktop lengths derive independently from a 60Hz pipeline: two frames for entry, one for pop. Arming the desktop head retires the birth anchor to avoid two interventions on one clock, the pairing the touch tier was built to avoid.

## Clock surgery is opt in

`nativeSurgeryAllowed` is the only field an author can change and defaults to off. First-frame holding, transition-start anchoring, and stall re-anchoring mutate a running animation's timing. The 2026-08 iPhone falsification series established that any timing touch on WebKit costs the accelerated out-of-process path or desynchronizes its re-sync.

By default, compiled animation runs untouched, with release scheduling protecting its opening. `driver: "native"` knowingly accepts the main-thread-presentation tradeoff; it never permits clock surgery on Blink.

## Shared head kit

`resolveHeadKit(status)` is a pure function of platform and status, independent of the transition. The morph runtime needs this answer before it can reliably read it from the DOM.

The engine writes the head's root attribute in the commit that stages a morph, but React runs descendant layout effects first. A morph reading the attribute sees the previous transition's answer: correct by luck from the second navigation onward, wrong on the first. This caused an element on the first push to run 33ms ahead of its screen while later pushes aligned.

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

Modern but weak touch Blink devices with UA-CH present are not legacy. They previously earned the governed head kit through the retired demotion machinery. The render-settle gate addresses the same mount weight from the other side and defaults to enabled for touch Blink.

Extending the kit to all touch Blink remains a possible next lever, but must not be done blindly: the 2026-08-14 round reverted blanket treatment after fast devices developed the compiled landing snap.
