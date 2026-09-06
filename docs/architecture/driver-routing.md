# Flight routing: which opening a flight gets

Accurate from `core/engine/flightRouting.ts` and the platform predicates it reads.

**There is no driver choice left.** Every flight is driven by the compiled CSS animation. The rAF motion player, the demotion strike machinery, the `driver: "player"` pin and the whole `flemo:*` override surface were retired (`f32c2cc`, `28d0377`, `47332c9`, `2be1e05`); a document describing which of two tiers wins is describing a decision that no longer exists.

What is routed now is narrower and is one call: given this browser, this navigation's status and this transition's authored options, **which opening treatment does the flight get, and may the engine touch its clock**. `resolveFlightRouting` answers it once per drive run, reading its probes live so a verdict formed mid-session lands on the next navigation.

## What it is asked

| Input | Meaning |
| --- | --- |
| `status` | `PUSHING` / `POPPING` / `REPLACING` / `COMPLETED` / `IDLE` |
| `transition` | The authored transition, read only for `driver: "native"` |
| `skipAnimation` | The scope carries the skip marker for this flight |
| `hasActiveMotion` | The active variant resolves a motion |
| `hasAnimation` | The active variant has an authored animation at all |

## What it answers

| Field | True when | What it turns on |
| --- | --- | --- |
| `hasDrivableMotion` | not skipped and the active variant resolves | there is motion to drive at all |
| `nativeSurgeryAllowed` | `driver: "native"` and not Blink | the engine may hold, anchor and re-anchor this flight's clock |
| `touchGoverned` | non-Blink and touch | the governed compiled tier |
| `forceCompiled` | non-Blink, touch, and `POPPING`, or `PUSHING` with the settle gate on | stands the wall-clock accelerators down |
| `governedHead` | `touchGoverned`, or legacy Android Blink, or `forceCompiled` | the flat opening segment baked into the keyframes |
| `desktopHead` | desktop macOS Safari | that tier's own flat head, with its own lengths and gate attribute |
| `birthHoldMs` | see the table below | how long the flat head holds |
| `governedSlide` | `touchGoverned` and `PUSHING` or `POPPING` | stands the wall-clock accelerators down for a slide |
| `framePacingKeepalive` | has an animation, Blink, and desktop or a measured high-refresh cadence | keeps a frame source alive so Chrome paces its presentation evenly |
| `creepHead` | `governedHead` on the governed tier | the head's end keyframe carries a translateZ hair, so the value changes across it |

Head lengths, in milliseconds:

| Kit | REPLACING | PUSHING | POPPING |
| --- | ---: | ---: | ---: |
| governed (`GOVERNED_HEAD_MS`) | 180 | 100 | 80 |
| desktop macOS Safari (`DESKTOP_HEAD_MS`) | 33 | 33 | 17 |

The desktop lengths are derived from a 60Hz pipeline, two frames for an entry and one for a pop, rather than inherited from the governed table. Arming the desktop head retires the birth anchor: two interventions on one clock is the pairing the touch tier was built to avoid.

## Why clock surgery is opt in

`nativeSurgeryAllowed` is the one field an author can move, and it is off by default. The first-frame hold, the flight-start anchor and stall re-anchoring all mutate a running animation's timing, and the 2026-08 iPhone falsification series established that on WebKit any such touch costs the accelerated out-of-process path or desyncs its re-sync. The default runs the compiled animation untouched and protects the opening by release scheduling instead. Writing `driver: "native"` takes the main-thread-presentation trade knowingly, and never applies on Blink.

## Why the head kit is extracted

`resolveHeadKit(status)` is a pure function of the platform and the status, with nothing about the flight in it, because the morph runtime needs the same answer at a moment when it cannot get it from the DOM. The head is announced by an attribute on the root, written by the engine in the same commit a morph is staged in, and React runs a descendant's layout effect first. A morph reading the attribute reads the previous flight's answer: right by luck from the second navigation on, and wrong on the first. That is what made a first push run its element 33ms ahead of the screen carrying it while every push after it was aligned.

## The predicates

| Predicate | Source |
| --- | --- |
| `detectBlinkEngine()` | `@platform/engineProbes` |
| touch | `navigator.maxTouchPoints > 0`, and no navigator means no touch surface |
| `governedCompiledActive()` | non-Blink and touch (`@platform/governedCompiled`) |
| `isLegacyAndroidBlink()` | no UA-CH brands, so confidently pre-2021 hardware |
| `isDesktopMacWebKit()` | `@platform/engineProbes` |
| `settleGateActive()` | governed compiled, or steady-60 desktop Blink, or touch Blink, or desktop macOS Safari |
| `learnedFrameIntervalMs()` | the measured cadence, against `COMPILED_TIER_MAX_INTERVAL_MS` |

## A known gap, deliberately open

A modern but weak touch Blink device (UA-CH present, so not legacy) used to earn the governed head kit through the demotion machinery, which is gone. The render-settle gate covers the same mount weight from the other side and is default on for touch Blink. Extending the kit to all touch Blink is the obvious next lever and must not be taken blind: the 2026-08-14 round reverted exactly that blanket treatment when fast devices picked up the compiled landing snap.
