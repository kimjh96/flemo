# Driver routing — the decision tree

Verbatim-accurate from `createTransitionEngine.ts` (`joinPlayer`, `forceCompiledStatus`),
`driverPolicy.ts`, `lowPowerCadence.ts`, and `motionDriverKind.ts` as of 2026-08-19
(post-#259, post-Blink-unification). `joinPlayer` returning **null** means the compiled CSS tier
drives; a successful join means the rAF player (numeric or scrub-WAAPI) drives.
Every participant of one navigation calls through the same gates with the same
transition and status, so a navigation never splits across drivers.

## The gates, in order

0. **Pin surfaced, unconditionally.** `driverPolicy.pinnedDriver()` is called once at
   `joinPlayer` entry _before any routing_, purely so the force-pin console warning
   fires even on paths that short-circuit below — "a forgotten pin must never run
   silently". (This call does not route; the pin's routing effects are noted per gate.)
1. **Chain gate (Blink only).** `detectBlinkEngine() && TaskManger.pendingTaskIds.some(id => id !== taskId)`
   → **compiled**. A replay chain (rapid back/forward storm) rides the compositor on
   Blink, where queued mount commits stall a main-thread player while the compositor
   glides. On non-Blink, chains ride the _player_ — the compiled clock there is stamped
   a whole pipeline before first glass and a chained flight born into a heavy commit is
   swallowed wholesale (device-video'd: chained pop as a one-frame swap).
2. **Blink compiled gate.** `detectBlinkEngine() && pinnedDriver() !== "raf"`
   → **compiled** (+ the display-interval re-probe is armed).

   **Blink is one rule now (2026-08-19): the compiled tier, everywhere.** Desktop
   settled there on the live-judged ladder; touch Blink used to default to the player
   and reach the compiled tier only by DEMOTION (two stalled flights, persisted per
   ORIGIN, re-probed once per session), which made a weak phone's behavior depend on
   which origin it had visited and how recently the page reloaded — the first flight
   after every load ran the player even when the ledger already said `css`. That is
   the intermittency users report as "sometimes it is much worse".

   The unification follows the engine's own model: on Blink the compiled path
   composites healthily, so it is a REFUGE there (on non-Blink it is the
   freeze-and-jump tier and never can be). A refuge reachable only after paying for
   two bad flights is a worse contract than routing there. What the player provided on
   touch Blink — a capped clock absorbing a mid-flight commit storm — is covered from
   the other side by the render-settle gate, default-on for touch Blink since PR #268.

   Consequences: `learnedFrameIntervalMs()`, `playerAllowed()` and
   `isLegacyAndroidBlink()` no longer participate in Blink routing (the last is still
   the image-decode offloader's auto-gate), and **demotion is off everywhere** — its
   only purpose was moving a starving Blink device to a tier Blink now always uses.

   **The raf pin pierces this whole gate** (`driverPolicy.pinnedDriver() !== "raf" &&`
   prefixes the condition — as of PR #259, merged 2026-08-17): a pinned session must
   player-drive everything to be a useful instrument, and it is the only route to the
   player's per-frame device-pixel snap on desktop. History matters here: the pierce
   was briefly retired in PR #256 because a pinned desktop re-entry (push→pop→push)
   left the entering screen at its from-pose (`translateX(100%)`) — a blank viewport.
   PR #259 proved that blank was NOT a player defect but a COMPLETED-cleanup lease bug
   (see motion-engine.md section 3), fixed the cleanup (explicit pose-channel strip),
   added a desktop-chromium e2e guard ("a pinned desktop player lands a re-entry
   on-screen"), and restored the pierce. **Default desktop routing is unchanged:
   compiled, always.**

3. **Desktop WebKit gate.** `!Blink && maxTouchPoints === 0 && /Mac/.test(platform)`
   → **compiled**. macOS Safari caps rAF at 60Hz even on a 120Hz panel, so the player
   can only ever paint half the display's frames (eye-verified tremor/judder; the
   css-pinned session cleared it). Desktop-WebKit compiled flights arm the one-shot
   birth-window start anchor (`armFlightStartAnchorAtRelease`, rewind form only).
   Real iPhones/iPads — including iPads spoofing a Mac platform — report
   `maxTouchPoints > 0` and skip this gate; jsdom reports an empty platform and stays
   on the player for the unit suites.
4. **Touch WebKit status gate** (`forceCompiledStatus`): `!Blink && maxTouchPoints > 0`
   and
   - `status === "POPPING" && !readHandoffFlag()`, or
   - `status === "PUSHING" && readSettleGateFlag() && !readHandoffFlag()`

   → **compiled**. `readSettleGateFlag()` defaults on for touch WebKit
   (`governedCompiledActive()`), touch Blink, and verified steady-60 desktop Blink —
   the table in `diagnosticFlags.ts` is the tested source of truth. `governedCompiledActive()`, which
   is true for every touch-WebKit session (see gate 5) — so by default both POP and
   PUSH route compiled here. `flemo:handoff=on` exempts both statuses from _this_ gate
   (the player+handoff instrument), but note gate 5 below.

5. **Touch WebKit governed-compiled gate.** `!Blink && maxTouchPoints > 0 &&
governedCompiledActive() && status ∈ {REPLACING, POPPING, PUSHING}` → **compiled**
   (+ re-probes the LPM cadence per routed flight).

   `governedCompiledActive()` (lowPowerCadence.ts) is today simply _"non-Blink + touch +
   rAF exists"_ — the governed-compiled treatment (compiled tier + `data-flemo-lpm`
   flat-head keyframes + settle gate + atomic release flip) was promoted from
   "detected Low Power Mode only" to the **default for every touch-WebKit flight**
   (device-confirmed on a 60Hz iPhone with LPM off). Consequences worth knowing:
   - ALL transitional statuses on touch WebKit route compiled — this gate catches even
     what gate 4's handoff exemption lets through, so on current main the
     `flemo:handoff` flag no longer reaches the player on touch WebKit (its remaining
     effect is inside the player for pinned/`raf` sessions). Several older comments in
     `joinPlayer` ("TOUCH WebKit keeps the device-verified player, wholesale") predate
     this promotion — trust the code order, not those paragraphs.
   - Actual-LPM detection (`lowPowerCadenceActive`) still runs and persists
     (`flemo:lpm`) but no longer changes routing; the flat-head sizes
     (`LPM_HEAD_MS` = REPLACING 180 / PUSHING 100 / POPPING 80 ms) apply to every
     governed flight as _deadline offsets_ + static gated keyframes.
   - Chained flights are NOT exempted here (the pending-chain guard was removed:
     navigations serialize at the controller, so a lingering pending task is not a real
     concurrent flight; the block a chain guard would absorb is handled by the settle
     gate instead).

6. **Pin gate.** `!driverPolicy.playerAllowed()` → **compiled**. Since 2026-08-19 this
   means one thing only: a `css` force pin. Demotion no longer contributes — `demotable`
   is now `false` for every engine (see below), so nothing else can make
   `playerAllowed()` false.
7. **Kind gate.** Unless `pinnedDriver() === "raf"`, `classifyTransitionDriver()` is
   consulted: it returns an authored `driver: "native" | "player"` pin if present, else
   `"player"` on every engine (the measured fast-mover carve-out is retired;
   `peakTranslationPxPerFrame` stays exported). `"native"` → **compiled** (with the
   native-surgery anchors for authored pins). A `raf` pin bypasses this gate — a pinned
   session must player-drive everything to be a useful instrument.
8. **Join.** The player registry joins scope, riding bars, decorator, and `<Part>`s;
   a variant neither tier can drive (no WAAPI _and_ not numerically parseable) returns
   null per-track and the compiled path stays in charge for it.

### Demotion strikes / probation / persistence (`driverPolicy.ts`)

**Demotion is OFF everywhere as of 2026-08-19** — `createDriverPolicy` is constructed
with `demotable: false`. It existed to move a starving Blink device onto the compiled
tier, and Blink now starts there, so there is nothing left to demote: a Blink flight
reaches the player only through a `raf` force pin, and a pin already overrides the
ledger. `beginRun`/`reportGap` still collect a run's gaps (`stats()` and the
diagnostics read them), but `endRun` returns before any strike can persist. Values
already written to `localStorage["flemo:motion-driver"]` on users' devices are simply
never read again; the key string stays frozen so an older build's value cannot be
misread.

The machinery below is retained, unreachable, for the record — and because a future
engine that puts the player back in production would need exactly it:

- A player run's gaps are judged at `endRun` against the run's final measured cadence
  (`max(30ms, 1.8 × frameInterval)`); ≥ 2 long gaps in one run = a _stalled_ run,
  ≥ `DEMOTION_STRIKES = 2` stalled runs = **demoted** (irreversible within the session)
  and persisted to `localStorage["flemo:motion-driver"] = "css"`.
- A persisted demotion was **probation**, not a life sentence: each new session the
  player got one probe transition; clean → record cleared (`"raf"` written), stalled →
  re-demoted from flight one.
- The `flemo:motion-driver-force` pin (`"css@<epoch-ms>"` / `"raf@<epoch-ms>"`,
  sessionStorage, 24h TTL, unstamped/stale values removed on sight) bypasses
  measurement, strikes, and probation in `playerAllowed()`/`pinnedDriver()` — but NOT
  gates 1–6 above except where noted. This is the live half: the pin is now the only
  input to `playerAllowed()`.

### What each `flemo:*` override does to routing

| Key                                                                     | Routing effect                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flemo:motion-driver-force=raf@<ts>`                                    | `playerAllowed()` true; **pierces the whole Blink compiled gate (2)** — the only route to the player on Blink now — and bypasses the kind gate (7). Does NOT pierce the chain gate (1), the desktop-WebKit gate (3), or the touch-WebKit gates (4–5). Warned once per session, expires in 24h. |
| `flemo:motion-driver-force=css@<ts>`                                    | `playerAllowed()` false → gate 6 routes everything compiled.                                                                                                                                                                                                                                   |
| `flemo:motion-driver` (localStorage)                                    | The learned demotion ledger. **Inert since 2026-08-19** (demotion off): still written by older builds, never read.                                                                                                                                                                             |
| `flemo:handoff=on`                                                      | Exempts POP/PUSH from gate 4 and enables the player's anchored-opening handoff (POP-scoped inside the player). On current main, gate 5 still routes touch WebKit compiled, so its practical reach is pinned/`raf` sessions and unit tests.                                                     |
| `flemo:settle-gate=on/off`                                              | Feeds gate 4's PUSH branch and the ScreenMotion release gate. Default = on for touch WebKit, touch Blink, and verified steady-60 desktop Blink; off elsewhere.                                                                                                                                 |
| `flemo:lpm=1/0`                                                         | Session-persisted LPM verdict seed (production state) — affects the cadence machinery, not routing, since the governed treatment no longer keys off it.                                                                                                                                        |
| `flemo:apply=scrub`                                                     | Not routing — forces the scrub-WAAPI application tier for every _player_ track.                                                                                                                                                                                                                |
| `flemo:snap`, `flemo:snapband`, `flemo:handoffms`, `flemo:landing-snap` | Value-application / easing shape only, no tier change (see diagnostics.md).                                                                                                                                                                                                                    |

## Decision tree

```
joinPlayer(variant, role):
  driverPolicy.pinnedDriver()            # surface pin warning, always
  ├─ no transition task id ──────────────────────────────► compiled
  ├─ [1] Blink && replay chain pending ──────────────────► compiled
  ├─ [2] Blink && pin != raf ────────────────────────────► compiled  (+probe)
  │        desktop AND touch, no cadence/demotion/legacy terms (2026-08-19)
  │                                       (raf pin pierces this whole gate — PR #259)
  ├─ [3] WebKit && desktop Mac (no touch) ───────────────► compiled  (+birth anchor)
  ├─ [4] WebKit && touch && forceCompiledStatus(status) ─► compiled
  │        POP: default (unless flemo:handoff=on)
  │        PUSH: settle-gate on (default) && !handoff
  ├─ [5] WebKit && touch && governedCompiledActive()     ─► compiled  (governed head,
  │        && status ∈ {PUSH,POP,REPLACE}                    data-flemo-lpm, atomic flip)
  │        governedCompiledActive() == true for ALL touch WebKit today
  ├─ [6] !playerAllowed() (css pin only — demotion off) ─► compiled
  ├─ [7] pin != raf && classify() == "native"
  │        (authored driver:"native" only) ──────────────► compiled  (+native surgery)
  └─ otherwise ──────────────────────────────────────────► rAF PLAYER
           per-track: numeric parse ok → inline-write tier
                      else WAAPI ok    → scrub tier
                      else             → that track stays compiled
```

## Worked examples

| Context                                            | Route on current main                                                                                                                                                         | Extras riding along                                                                                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone Safari, normal                              | Governed **compiled** for PUSH/POP/REPLACE (gates 4+5)                                                                                                                        | Settle gate on by default, `data-flemo-lpm` flat-head keyframes (180/100/80ms), atomic DOM release flip, NO wall-clock perceptual cut/early landing, no stall watch |
| iPhone Safari, Low Power Mode                      | Same governed **compiled** path (routing identical; LPM detection persists `flemo:lpm` but no longer gates)                                                                   | rAF-capped ~30Hz observers; latency ledger (`flemo:lat`) sizes nothing visual — flat head is static                                                                 |
| Pixel 9, Chrome (touch Blink, UA-CH brands)        | **Compiled from flight one** — Blink is unconditional since 2026-08-19                                                                                                        | Settle gate default-on (PR #268); the raf pin is the only route to the player                                                                                       |
| Galaxy Note 9, any Chromium browser (touch Blink)  | **Compiled from flight one** (was `isLegacyAndroidBlink`-only; now every Blink session)                                                                                       | Governed head kit (`routedBlinkGoverned` → `data-flemo-lpm` + LPM_HEAD_MS deadlines); image decode offloader auto-on                                                |
| Desktop Chrome                                     | **Compiled**, unconditionally (gate 2)                                                                                                                                        | Governed landing easing, frame-pacing keepalive rAF (session-permanent once armed), display-interval probe                                                          |
| Desktop Chrome + `flemo:motion-driver-force=raf@…` | **Player** (pin pierces gate 2; PR #259). Pin warning printed once per session; re-entries land on-screen thanks to the COMPLETED pose strip, e2e-guarded on desktop chromium | Player snap instrumentation reachable on desktop again                                                                                                              |
| Desktop Safari                                     | **Compiled** (gate 3)                                                                                                                                                         | One-shot birth-window start anchor at release                                                                                                                       |
| jsdom / unit suites                                | **Player** (empty platform skips gate 3; no touch, non-Blink)                                                                                                                 | This is why unit tests exercise the player by default                                                                                                               |
