import TaskManger from "@core/TaskManger";

import {
  clearInlineAnimation,
  concludeInlineSettle,
  trackInlineWrite
} from "@transition/animateInline";
import {
  DESKTOP_HEAD_MS,
  GOVERNED_HEAD_MS,
  matchesFlightAnimationName,
  animationName,
  variantHasAnimation
} from "@transition/compileTransitionStyles";
import resolveTransition from "@transition/resolveTransition";

import type { TransitionVariant } from "@transition/typing";
import { resolveVariantMotion, type VariantMotion } from "@transition/variantMotion";

import createArrivalHold from "@core/engine/arrivalHold";
import holdCompositorWarm from "@core/engine/compositorWarmUp";
import {
  readArrivalHoldFlag,
  readDesktopHeadFlag,
  readImageHoldFlag,
  readCreepHeadFlag,
  readSettleGateFlag
} from "@core/engine/diagnosticFlags";
import { learnedFrameIntervalMs, reportDisplayIntervalMs } from "@core/engine/displayCadence";
import { noticeDeviceEmulationOnce } from "@core/engine/emulationNotice";
import {
  detectBlinkEngine,
  isDesktopMacWebKit,
  isLegacyAndroidBlink
} from "@core/engine/engineProbes";
import { beginFlightWindow } from "@core/engine/flightWindow";
import { governedCompiledActive } from "@core/engine/governedCompiled";
import { stampAsyncImageDecode } from "@core/engine/imageDecodeHygiene";
import { beginImageRevealHold } from "@core/engine/imageRevealHold";
import createInvisibleAnimationHold from "@core/engine/invisibleAnimationHold";
import { governedEasingForMotion } from "@core/engine/landingGovernor";
import { holdScopeLayer, releaseScopeLayerAfterSettle } from "@core/engine/layerSettleHold";

import {
  armFlightStartAnchorAtRelease,
  holdNativeClocksToFirstFrame,
  watchNativeStalls
} from "@core/engine/nativeStallAnchor";
import { perceptualCutMs } from "@core/engine/perceptualSpan";
import { beginResponseHold } from "@core/engine/responseHold";
// The engine no longer consults the steady-60 verdict at all: the landing
// placement is uniform and the image hold is opt-in. It still FEEDS it — the
// display probe below reports the in-flight cadence the desktop cadence lock
// and the settle-gate default read.
import { reportInFlightCadence } from "@core/engine/steadySixtyCadence";
import {
  SKIP_ANIMATION_ATTR,
  type ScreenLifecycleInput,
  type TransitionEngine,
  type TransitionEngineDeps
} from "@core/engine/types";
import { decoratorMap } from "@transition/decorator/decorator";
import { partTransitionMap } from "@transition/partTransition/partTransition";

const noop = () => {};

// How long the compositor warm-up outlives COMPLETED: covers the +2rAF
// landing reveal and the convergence commits (drops measured at 400-700ms
// into 600ms flights), comfortably under the warm-up's own 3s backstop.
const WARM_SETTLE_MS = 400;

// How many vsyncs a clean end waits before the COMPLETED flip so the motion's
// last frames actually reach the glass first. Two covers the write; WebKit
// presents from the main thread with a 1-2 frame pipeline behind it, and a
// measured ~30ms flip commit starting at write+2 still delayed the decel
// tail's final frame on device (the "blip at the end" of a pop). Four puts
// the flip past that pipeline; the screen holds its arrival pose under the
// compiled rules meanwhile, so the extra ~33ms is invisible.
const LANDING_CLEAR_FRAMES = 4;

// Timeout insurance for the landing-clear deferral (a clean end resolves a
// few rAFs after the last motion frame so the COMPLETED flip's commit cannot
// cut it — see resolvePresented): rAF suspends in background tabs, and the
// navigation queue must never hang on an invisible deferral.
const LANDING_CLEAR_FALLBACK_MS = 100;

// How far past the authored motion span the anchored task gate stays armed —
// the same recovery margin the liveness floor uses, so the gate only ever
// fires on a genuinely stranded task, never on a long authored duration.
const GATE_MOTION_MARGIN_MS = 1500;

const PART_NAME_ATTR = "data-flemo-part-name";

// The first-frame clock hold resolves on its own rAF, potentially after the
// release run has armed its wall-clock deadlines — this slot lets the hold
// push THAT run's deadlines the same way a stall shift would (the closures
// are per-effect-run, the hold is per-flight).
const startHoldDisarms = new WeakMap<HTMLElement, () => void>();

// This screen's <Part> elements. The container (the scope's parent) hosts
// bar-mounted parts too; parts owned by a NESTED screen inside the container
// belong to that screen's own engine and are excluded.
const ANIM_HOLD_ATTR = "data-flemo-anim-hold";

const collectScreenParts = (scope: HTMLElement): HTMLElement[] => {
  const container = scope.parentElement ?? scope;
  return Array.from(container.querySelectorAll<HTMLElement>(`[${PART_NAME_ATTR}]`)).filter(
    (part) => {
      const owner = part.closest("[data-flemo-screen]");
      return !owner || owner === scope || !container.contains(owner);
    }
  );
};

// The subset currently mirroring this join's variant (parts self-carry their
// screen's status/active, which the compiled part selectors match on).
const collectVariantParts = (scope: HTMLElement, variant: TransitionVariant): HTMLElement[] => {
  const [status, active] = variant.split("-");
  return collectScreenParts(scope).filter(
    (part) =>
      part.getAttribute("data-flemo-status") === status &&
      part.getAttribute("data-flemo-active") === active
  );
};

// Pin the compiled promotions inline for one side of the flight (see
// layerSettleHold.ts): the screen scope, its riding shared bars (they run
// the screen's own rule, so they share its property list and containment),
// the decorator, and this side's <Part> elements — every element whose
// variant rule un-matching at the COMPLETED flip would demote-and-repaint a
// compositor layer on the convergence frames. Each participant is gated on
// its OWN definition's animation (a motionless screen can still carry an
// animating decorator or part — REVEAL-shaped transitions). Containment
// mirrors the rules' `contain: layout` scoping (PUSHING/REPLACING only).
// The WHOLE choreography's span for one status: the longest of the screen
// transition's BOTH variants (active and passive — either side may be the
// long-authored one) and every <Part> participating in this status. Any
// deadline meant to outlast "the flight" must derive from this, not from one
// screen's variant — the response hold's backstop learned that the hard way
// (a 700ms screen with a 3s Part flushed parked responses mid-Part).
// Parts participating in THIS Router's flight, by the EXPLICIT boundary
// marker: the React binding stamps every screen and shared bar with its
// owning Router's identity (`data-flemo-router`, see RouterIdContext). A
// document-global status query let an unrelated Router's 3s part inflate
// this navigation's gate, floor, and response backstop — and DOM-structure
// inference cannot draw the line: each screen sits in its own wrapper (so
// the two screens of ONE flight share no parent), a root Router renders no
// container at all, and two independent Routers may share a DOM parent.
// Marker semantics: a part qualifies when its nearest marked carrier
// (screen or bar) carries the SAME Router id as the scope's. Either side
// missing a marker (a binding predating the stamp, detached test fixtures)
// keeps the old inclusive behavior — over-waiting is a delay, cross-cutting
// is a truncation.
const collectFlightParts = (scope: HTMLElement, status: string): HTMLElement[] => {
  const ownCarrier = scope.closest("[data-flemo-router]");
  const flightId = ownCarrier?.getAttribute("data-flemo-router") ?? null;
  return Array.from(
    scope.ownerDocument.querySelectorAll<HTMLElement>(
      `[${PART_NAME_ATTR}][data-flemo-status="${status}"]`
    )
  ).filter((part) => {
    if (flightId === null) return true;
    const carrier = part.closest("[data-flemo-router]");
    if (!carrier) return true;
    return carrier.getAttribute("data-flemo-router") === flightId;
  });
};

// Flight parts that no held element CONTAINS. The compiled hold rule pauses
// `[data-flemo-anim-hold=…]` and its `[data-flemo-part-name]` DESCENDANTS, so
// a Part inside a screen rides the screen's own hold and a Part inside a
// shared bar rides the bar's — the React binding stamps the attribute on
// both. A Part mounted OUTSIDE any screen has neither. <Part> supports that
// position deliberately (its own header: "a persistent header next to a
// <Slot>, a portal"), and the compiled part selector keys on name + status +
// active with NO structural term, so such a part is driven by this flight's
// keyframes while nothing pauses it: it animated straight through the hold
// window with every screen parked, then led the flight by the whole hold —
// the defect the decorator once had ("the dim faded in ahead of the held
// screens", 2026-08-13).
//
// Scoped through collectFlightParts, i.e. by the EXPLICIT `data-flemo-router`
// marker rather than DOM ancestry. That is not a preference: RouterIdContext
// exists precisely because structure cannot draw this boundary (a root Router
// renders no container, two Routers may share a parent), and each screen sits
// in its own wrapper — so a container-scoped walk from the scope reaches only
// this screen's own subtree, where every Part host is already held. It would
// find nothing that needs holding.
//
// The ancestor test deliberately starts at the PARENT: a part this engine has
// already stamped must still be found, so the release can re-derive the same
// set instead of trusting a record the DOM may have changed under.
const collectUnheldOuterParts = (scope: HTMLElement, status: string): HTMLElement[] =>
  collectFlightParts(scope, status).filter(
    (part) => part.parentElement?.closest(`[${ANIM_HOLD_ATTR}]`) == null
  );

// The release sweep is deliberately status-AGNOSTIC while the stamp above is
// status-scoped. Stamping narrowly keeps the pause off parts this flight does
// not drive (`animation-play-state` is per-ELEMENT: it would pause whatever
// the consumer authored on that part too). Clearing broadly guarantees the
// pause cannot outlive the flight if the part's own status attribute moved in
// a different commit than this drive — a leak would freeze persistent chrome
// indefinitely, so the two sides must not share a predicate.
const collectStampedOuterParts = (scope: HTMLElement): HTMLElement[] => {
  const flightId = scope.closest("[data-flemo-router]")?.getAttribute("data-flemo-router") ?? null;
  return Array.from(
    scope.ownerDocument.querySelectorAll<HTMLElement>(`[${PART_NAME_ATTR}][${ANIM_HOLD_ATTR}]`)
  ).filter((part) => {
    if (part.parentElement?.closest(`[${ANIM_HOLD_ATTR}]`) != null) return false;
    if (flightId === null) return true;
    const carrier = part.closest("[data-flemo-router]");
    return !carrier || carrier.getAttribute("data-flemo-router") === flightId;
  });
};

const statusChoreographySpanMs = (
  scope: HTMLElement,
  transition: ReturnType<typeof resolveTransition>,
  status: string
): number => {
  let spanMs = 0;
  for (const variant of [`${status}-true`, `${status}-false`] as TransitionVariant[]) {
    if (!variantHasAnimation(transition, variant)) continue;
    const motion = resolveVariantMotion(transition, variant);
    if (motion) spanMs = Math.max(spanMs, (motion.delay + motion.duration) * 1000);
  }
  for (const part of collectFlightParts(scope, status)) {
    const definition = partTransitionMap.get(part.getAttribute(PART_NAME_ATTR)!);
    const partVariant = `${status}-${part.getAttribute("data-flemo-active")}` as TransitionVariant;
    if (!definition || !variantHasAnimation(definition, partVariant)) continue;
    const motion = resolveVariantMotion(definition, partVariant);
    if (motion) spanMs = Math.max(spanMs, (motion.delay + motion.duration) * 1000);
  }
  // The decorator is a full participant too (it joins the shared player): a
  // 3s custom dim over a 700ms screen must extend every flight deadline,
  // exactly like a long-authored Part.
  const decoratorDefinition = transition.decoratorName
    ? decoratorMap.get(transition.decoratorName)
    : undefined;
  if (decoratorDefinition) {
    for (const variant of [`${status}-true`, `${status}-false`] as TransitionVariant[]) {
      if (!variantHasAnimation(decoratorDefinition, variant)) continue;
      const motion = resolveVariantMotion(decoratorDefinition, variant);
      if (motion) spanMs = Math.max(spanMs, (motion.delay + motion.duration) * 1000);
    }
  }
  return spanMs;
};

// The render-settle gate (react ScreenMotion, `flemo:settle-gate`) holds the
// anim-hold release until the entering screen's MOUNT render storm quiesces —
// so by release the heavy commit is already painted and the release update is
// LIGHT. That is exactly what lifts the POP-only limit on compiled routing: a
// PUSH's swallowed opening came from its heavy mount commit aging the CSS
// clock past the governed head; with the gate that weight is behind us, so the
// fixed head covers a PUSH the same way it covers a POP. Read here so the
// engine only routes a PUSH to compiled when the gate is actually smoothing it.
// The render-settle gate is ON BY DEFAULT for touch WebKit (governedCompiledActive)
// and for desktop macOS Safari (isDesktopMacWebKit — just as main-thread-clocked):
// the governed-compiled opening only presents cleanly when the release waits for
// the entering mount's render to quiesce, so it ships with the tier. An explicit
// `flemo:settle-gate=off` opts out; `=on` is redundant now but still honored
// (see readSettleGateFlag in diagnosticFlags.ts — shared with react's
// ScreenMotion so both sides always agree).

// Which touch-WebKit statuses take the GOVERNED HEAD KIT — the flat head that
// covers a compiled flight's opening while the entering mount's commit ages the
// wall clock.
// POP always: device-measured, a heavy returning screen's re-commit swallows
// POP's opening exactly like PUSH's.
// PUSH: only when the settle gate is on, which moves that mount weight into the
// hold so the release is light enough for the fixed head to cover the opening —
// the same way it already covers POP.
const forceCompiledStatus = (status: string): boolean =>
  status === "POPPING" || (status === "PUSHING" && readSettleGateFlag());

// High-refresh threshold for the compiled tier's landing governor (see
// landingGovernor.ts): 12ms sits between 120Hz (8.3) and 90Hz (11.1) on one
// side and 60Hz (16.7) on the other — and a power-throttled presentation (30Hz
// measured on battery) never qualifies.
const COMPILED_TIER_MAX_INTERVAL_MS = 12;

// Frame-pacing keepalive for Blink's COMPILED tier. A compositor-driven flight
// leaves the main thread idle, and Chrome then paces its macOS ProMotion
// presentation UNEVENLY — video-measured at 120fps, a full-screen slide
// drops/duplicates frames mid-flight (a near-zero inter-frame delta followed
// by a double-step) and the eye reads it as trembling, which rAF timing on the
// main thread cannot see because the animation's value function is smooth.
// Device-confirmed: an empty `requestAnimationFrame` loop running for the
// flight visibly steadies the cadence (the compositor keeps presenting on every
// vsync while a frame source is live). The callback does nothing — its mere
// existence is the fix. Ref-counted so overlapping flights share one loop, and
// armed only for compiled Blink flights (WebKit and the rAF player already keep
// a frame source alive).
// CONTINUOUS once started — never stopped for the rest of the page session.
// A per-flight loop lets Chrome re-ramp its macOS ProMotion panel from idle
// 60Hz on every deliberate navigation (a cold opening), which is why an
// on/off loop barely helped while the device A/B — a NEVER-stopping rAF — did.
// The callback does nothing; a live frame source is the whole point, and it
// costs a single empty rAF. Armed lazily on the first compiled Blink flight
// (so it never runs before the app navigates) and then kept warm forever.
let keepaliveHandle: number | null = null;
const keepaliveTick = () => {
  keepaliveHandle =
    typeof requestAnimationFrame === "function" ? requestAnimationFrame(keepaliveTick) : null;
};
const armFramePacingKeepalive = (): (() => void) => {
  if (keepaliveHandle === null && typeof requestAnimationFrame === "function") {
    keepaliveHandle = requestAnimationFrame(keepaliveTick);
  }
  // No release: the frame source stays warm for the session so the NEXT
  // deliberate navigation opens on an already-120Hz panel.
  return noop;
};

// Re-sample the display cadence while flights run WITHOUT a player (the
// routed-compiled state has no player to learn from): six rAF gaps, median
// reported back to the player module. One probe at a time.
// (2026-08-12 note: a retrying, slow-vouching variant of this probe powered
// an iOS Low Power Mode routing experiment — LPM caps rAF at ~30Hz while
// the compositor presents at panel rate, so slides were routed compiled
// there. Device-revoked same day: real pushes exposed the compiled tier's
// unfixable release-commit clock aging as a WORSE whoosh than the player's
// 30fps even-stepping, and the slow-vouched learned interval destabilized
// Blink's governed-easing parameters mid-session. The 30fps even-stepped
// player IS the correct response to an OS power policy.)
let displayProbeActive = false;
// Bumped on every arm AND every cancel; a tick whose generation is stale
// stops scheduling and reports nothing. Cancellation matters on adaptive
// panels: a probe outliving its compiled flight measures the IDLE clock,
// which reads ~60Hz there — exactly the value that must never feed the
// steady-60 verdict (in-flight is the only honest window, see
// steadySixtyCadence.ts).
let displayProbeGeneration = 0;
const cancelDisplayIntervalProbe = () => {
  if (!displayProbeActive) return;
  displayProbeGeneration += 1;
  displayProbeActive = false;
};
// Module state outlives a test file's cases (a probe armed by one test would
// block every later arm); same pattern as diagnosticFlags' reset exports.
export const resetDisplayProbeForTests = () => {
  displayProbeGeneration += 1;
  displayProbeActive = false;
};
// Two skipped warm-up gaps + an 8-gap median: the probe arms in the same
// commit that releases the flight, so its FIRST gaps ride the entering
// screen's mount-commit stall — measured on the playground push, the raw
// 6-gap median read 30ms+ on a healthy 60Hz panel and poisoned every
// cadence consumer. The warm-up lets the commit clear while the compositor
// animation (the panel-rate anchor this probe exists to observe) keeps
// running; the wider window makes the median robust to one or two stragglers.
const DISPLAY_PROBE_WARMUP_TICKS = 2;
const DISPLAY_PROBE_GAPS = 8;
const armDisplayIntervalProbe = () => {
  if (displayProbeActive || typeof requestAnimationFrame !== "function") return;
  displayProbeActive = true;
  const generation = ++displayProbeGeneration;
  const gaps: number[] = [];
  let warmup = DISPLAY_PROBE_WARMUP_TICKS;
  let lastTick: number | null = null;
  const tick = (time: number) => {
    if (generation !== displayProbeGeneration) return;
    if (lastTick !== null) {
      if (warmup > 0) warmup -= 1;
      else gaps.push(time - lastTick);
    }
    lastTick = time;
    if (gaps.length < DISPLAY_PROBE_GAPS) {
      requestAnimationFrame(tick);
      return;
    }
    displayProbeActive = false;
    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    reportDisplayIntervalMs(median);
    // The RAW median additionally feeds the steady-60 verdict (the learned
    // interval above is clamped to the 60Hz nominal, which would erase the
    // 60-vs-unmeasured distinction the verdict needs). This probe only runs
    // during compiled flights — a compositor animation is live, so an
    // adaptive panel is at its true rate (see steadySixtyCadence.ts). The
    // window's max gap rides along so the verdict can reject jam-noise
    // windows (rAF catch-up bursts fake a fast median).
    reportInFlightCadence(median, sorted[sorted.length - 1]!);
  };
  requestAnimationFrame(tick);
};

const holdParticipantLayers = (
  elements: {
    scope: HTMLElement;
    decorator?: HTMLElement | null;
    bars?: (HTMLElement | null | undefined)[];
  },
  transition: ReturnType<typeof resolveTransition>,
  variant: TransitionVariant,
  owner: symbol
) => {
  const { scope, decorator, bars } = elements;
  const status = variant.split("-")[0];
  const containment = status === "PUSHING" || status === "REPLACING";
  // The landing governor for the COMPILED tier (see landingGovernor.ts): on
  // touch Blink at a genuine high-refresh cadence, the authored curve's
  // sub-pixel tail parks the sheet short of its landing and the COMPLETED flip
  // closes the gap late — the reshaped easing sprints the tail at one device
  // pixel per frame instead. Stamped as an INLINE longhand (clearInlineAnimation
  // strips it at COMPLETED with animation-delay); a riding bar shares the
  // screen's string so the pair stays in lockstep.
  //
  // Desktop removed (2026-08-18): the governor's 1-device-px tail sprint IS the
  // reported pop "드르륵" on 60Hz HiDPI desktops — the compiled tier runs the
  // AUTHORED easing untouched there, exactly like any well-made compositor
  // animation. Touch high-refresh keeps it (device-verified).
  const governEasing =
    detectBlinkEngine() &&
    typeof navigator !== "undefined" &&
    navigator.maxTouchPoints > 0 &&
    learnedFrameIntervalMs() < COMPILED_TIER_MAX_INTERVAL_MS;
  const dpr = governEasing && typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const easingFor = (motionSource: VariantMotion | null, box: HTMLElement): string | null => {
    if (!motionSource || !governEasing) return null;
    return governedEasingForMotion(motionSource, box, dpr, learnedFrameIntervalMs());
  };
  if (variantHasAnimation(transition, variant)) {
    holdScopeLayer(scope, transition, containment, owner);
    const scopeMotion = resolveVariantMotion(transition, variant) ?? null;
    const easing = easingFor(scopeMotion, scope);
    if (easing) {
      trackInlineWrite(scope, "animation-timing-function", owner);
      scope.style.animationTimingFunction = easing;
    }
    for (const bar of bars ?? []) {
      if (bar?.getAttribute("data-flemo-bar-riding") === "true") {
        holdScopeLayer(bar, transition, containment, owner);
        if (easing) {
          trackInlineWrite(bar, "animation-timing-function", owner);
          bar.style.animationTimingFunction = easing;
        }
      }
    }
  }
  if (decorator && transition.decoratorName) {
    const definition = decoratorMap.get(transition.decoratorName);
    if (definition && variantHasAnimation(definition, variant)) {
      holdScopeLayer(decorator, definition, containment, owner);
    }
  }
  for (const part of collectVariantParts(scope, variant)) {
    const definition = partTransitionMap.get(part.getAttribute(PART_NAME_ATTR)!);
    if (definition && variantHasAnimation(definition, variant)) {
      holdScopeLayer(part, definition, containment, owner);
      const partMotion = resolveVariantMotion(definition, variant) ?? null;
      const partEasing = easingFor(partMotion, part);
      if (partEasing) {
        trackInlineWrite(part, "animation-timing-function", owner);
        part.style.animationTimingFunction = partEasing;
      }
    }
  }
};

// The COMPLETED counterpart: queue every participant's demotion off-cadence,
// LAYER_SETTLE_MS past the flip. Unstamped elements no-op, so this is safe
// to call unconditionally — including for swipe-promoted bars, whose inline
// `will-change` (createSwipeController's pre-promotion) previously dropped
// IN the flip commit and now rides the same deferred clock.
const releaseParticipantLayers = (
  elements: {
    scope?: HTMLElement | null;
    decorator?: HTMLElement | null;
    bars?: (HTMLElement | null | undefined)[];
  },
  owner: symbol
) => {
  const { scope, decorator, bars } = elements;
  if (scope) {
    releaseScopeLayerAfterSettle(scope, owner);
    for (const part of collectScreenParts(scope)) releaseScopeLayerAfterSettle(part, owner);
  }
  if (decorator) releaseScopeLayerAfterSettle(decorator, owner);
  for (const bar of bars ?? []) {
    if (bar) releaseScopeLayerAfterSettle(bar, owner);
  }
};

// Cancel-resume budget: how many browser-cancels of one element's compiled
// animation the engine will resume before conceding (the active scope then
// resolves its task; a pure-resume participant simply stops). Bounds the churn
// of a suspended-mount commit re-invalidating the layer repeatedly.
const RESUME_BUDGET = 4;

// Whole-millisecond CSS time string. Guards against float noise in the inline
// `animation-delay` (e.g. -0.075 instead of -0.07500000000000001).
const cssSeconds = (seconds: number) => `${Math.round(seconds * 1000) / 1000}s`;

interface CancelResumeConfig {
  element: HTMLElement;
  // The compiled animation name this element runs; cancels of any other name
  // (a decorator's, a foreign transition's) are ignored.
  expectedName: string;
  // The variant's timing, for the resume clamp and the rejoin delay.
  motion: VariantMotion;
  // Whether recovery may still act: the transition is current, the element is
  // live, and no swipe committed it out. A dead participant terminates.
  isLive: () => boolean;
  budgetUsed: () => number;
  spendBudget: () => void;
  // Budget spent, clock past the end, or not live. The active scope resolves
  // its task; a pure-resume participant does nothing.
  onTerminal: () => void;
  // The lease writer for the rejoin delay (the engine instance's token), so
  // ownership holds end-to-end instead of falling back to the global stake.
  writer?: symbol;
}

// Wire cancel-resume liveness on ONE compiled-CSS participant. WebKit silently
// cancels a running compositor animation when a sibling commit churns the
// layer (a Suspense fallback mounting mid-transition); the animation fires
// `animationcancel` and NEVER `animationend`. Rather than replay from the
// start (a visible jump) or resolve early (a single-frame cut), this
// re-establishes the compiled animation rejoined to its ORIGINAL timeline: the
// standard drop-reflow-restore trick plus an inline `animation-delay` that
// rewinds the clock to where the cancel landed (negative past the delay phase,
// so the resume picks up mid-flight and ends on the original schedule).
const wireCancelResume = (config: CancelResumeConfig) => {
  const { element, expectedName, motion } = config;
  // True only during our own drop-reflow-restore mutation, so a synchronous
  // cancel/start the real compositor emits from it is ignored (jsdom fires
  // neither, but the guard keeps the browser path re-entrancy-safe).
  let midRestart = false;
  // Whether this recovery has written an inline rejoin delay that outlives it
  // if not cleaned: an interrupt (a NEW transition superseding this one on the
  // same element) tears the controller down before COMPLETED runs its own
  // clearInlineAnimation, so detach must restore the delay itself — otherwise
  // the next transition inherits the stale negative delay and starts mid-way.
  let wroteRejoinDelay = false;

  // Standard restart trick (drop → reflow → restore the compiled rule), with
  // one of three treatments for the inline rejoin delay:
  //   "keep"  — leave it untouched (a plain restart of an animation that never
  //             entered its active phase, so there's no rejoin delay to manage);
  //   "set"   — write the negative rejoin delay that resumes mid-flight;
  //   "clear" — strip any rejoin delay (a watchdog full-restart from `from`).
  const restart = (delay: { mode: "keep" | "clear" } | { mode: "set"; seconds: number }) => {
    midRestart = true;
    element.style.animation = "none";
    void element.offsetWidth;
    element.style.removeProperty("animation");
    if (delay.mode === "clear") {
      element.style.removeProperty("animation-delay");
      wroteRejoinDelay = false;
    } else if (delay.mode === "set") {
      trackInlineWrite(element, "animation-delay", config.writer);
      element.style.animationDelay = cssSeconds(delay.seconds);
      wroteRejoinDelay = true;
    }
    midRestart = false;
  };

  const onCancel = (event: AnimationEvent) => {
    if (midRestart) return;
    // A head tier fires under a suffixed keyframe name (`<name>-gov`,
    // `<name>-deskhead`) — same flight, same resolver.
    if (
      event.target !== element ||
      !matchesFlightAnimationName(event.animationName, expectedName)
    ) {
      return;
    }
    if (!config.isLive() || config.budgetUsed() >= RESUME_BUDGET) {
      config.onTerminal();
      return;
    }
    // The ACTIVE-phase time elapsed at cancel, straight from the event (CSS
    // Animations spec: animationcancel.elapsedTime is the active duration
    // elapsed, EXCLUDING delay — 0 if cancelled while still delaying, and
    // it already accounts for a negative rejoin delay on a re-cancel). This
    // is the authoritative resume point: the old performance.now()-since-
    // animationstart bookkeeping re-added `motion.delay` and, for a POSITIVE
    // delay, made a mid-active cancel wait the delay out all over again.
    const activeElapsedMs = Math.max(0, event.elapsedTime * 1000);
    const durationMs = motion.duration * 1000;
    // durationMs > 0 guard: a duration-0 variant (delay-only authoring) would
    // otherwise read `0 >= 0` as finished and skip its remaining delay — it
    // must take the replay path below instead.
    if (durationMs > 0 && activeElapsedMs >= durationMs) {
      // Past the active end — the compiled rest rule owns the pose.
      config.onTerminal();
      return;
    }
    config.spendBudget();
    if (activeElapsedMs <= 0) {
      // Cancelled during the delay (or exactly at active start): nothing of
      // the active phase was presented, so replay delay + motion from the
      // top. ACCEPTED trade-off: the event carries no delay-phase position
      // (elapsedTime is active-only, 0 while delaying), so the authored delay
      // replays in full rather than resuming its remainder — visually
      // seamless (the from-pose showed throughout the delay and keeps
      // showing), merely late for pathologically long authored delays.
      // Preserving the exact position would need the wall-clock bookkeeping
      // whose delay-double-count bug this event-based model replaced.
      restart({ mode: "keep" });
      return;
    }
    // Resume INTO the active phase: a negative delay of the elapsed active
    // time, and NO re-delay (the browser already consumed the authored delay).
    restart({ mode: "set", seconds: -activeElapsedMs / 1000 });
  };

  return {
    // Attach is explicit so the active scope can construct the controller (the
    // watchdog needs its fullRestart) without wiring the listener on the
    // player-driven path, where it'd catch the join's own `animation: none`.
    attach: () => {
      element.addEventListener("animationcancel", onCancel);
    },
    detach: () => {
      element.removeEventListener("animationcancel", onCancel);
      // Restore the rejoin delay to the consumer's original (via the lease) so
      // an interrupt never bleeds this transition's clock offset into the next.
      if (wroteRejoinDelay) {
        clearInlineAnimation(element, ["animation-delay"], config.writer);
        wroteRejoinDelay = false;
      }
    },
    // Watchdog full-restart: replay from the compiled `from` on a fresh clock,
    // dropping any rejoin delay.
    fullRestart: () => {
      restart({ mode: "clear" });
    }
  };
};

// Framework-neutral transition engine. Created once per router scope with a
// minimal set of injected store callbacks; the binding (React, etc.) feeds it
// plain DOM elements and the current transition state. The engine owns the
// hard, reusable part: HOW the motion is driven, when the navigation task
// resolves and what gets cleaned up. Declarative output (data-attributes,
// initial/content styles) stays in the binding's render.
//
// Motion driving is two-path, decided per variant by the library:
// - Player-drivable variants (transform/opacity/template-string motion — all
//   presets) run on the rAF transition player: every participant of the
//   navigation steps off one clock, immune to the compositor-animation
//   judder Chromium exhibits on raster-heavy layers.
// - Anything the player can't provably interpolate keeps the compiled CSS
//   animation exactly as before.
export default function createTransitionEngine(deps: TransitionEngineDeps): TransitionEngine {
  // This engine instance's layer-hold owner token, distinct per instance so
  // two nested Routers promoting the SAME shared bar refcount independently —
  // a module-global token would collapse both into one holder and let the
  // first to finish demote the layer out from under the other.
  const layerOwner = Symbol("flemo-engine-layer");

  // Cancel-resume budget for the ACTIVE scope's compiled-CSS liveness recovery
  // (see the active path below): how many resumes each in-flight task has spent
  // on its screen animation. Keyed by task id, NOT by effect run — the anim-hold
  // release re-runs the driver effect, and a per-run counter would hand the same
  // transition a fresh budget each re-run. Pruned on task resolution and on
  // stale teardown (a resolved or superseded task's entry is dropped), so it
  // tracks only the handful of genuinely-recovering in-flight tasks and never
  // grows unbounded the way the old add-only Set did. Pure-resume participants
  // (decorator, bars, parts, the passive scope) budget per drive-run instead —
  // their counters live and die with the wiring closure.
  const activeResumeCounts = new Map<string, number>();

  // The in-flight commit hold for this screen's CURRENT transition (see
  // arrivalHold.ts). Engine-level, not per drive-run: the driver effect
  // re-runs mid-transition (the anim-hold release), and the hold must span
  // those re-runs and release only at COMPLETED or on an interrupt.
  let releaseArrivalHold: (() => void) | null = null;
  // The WARM side's image-only hold (see the holdsFlightImages block in the
  // drive). Engine-level for the same spanning reason as the arrival hold.
  let releaseFlightImageHold: (() => void) | null = null;
  // This screen's hold on the compositor warm-up (see compositorWarmUp.ts).
  // Engine-level for the same reason as the arrival hold: the driver effect
  // re-runs mid-transition, and the warm-up must span those re-runs and end
  // only when the screen leaves its transitional statuses.
  let releaseWarm: (() => void) | null = null;
  // The warm-up outlives COMPLETED by the settle window. The convergence
  // storm — status-flip commits, the covered screen's freeze, the landing
  // reveal two frames past COMPLETED — lands right AFTER the motion rests,
  // where frame production is back to on-demand; measured on the user's own
  // machine (attached real Chrome, 180s of hand-driven journeys) as 17
  // dropped frames clustered at 400-700ms into 600ms flights with no
  // compositor animation live — the convergence tremor. Forcing frames
  // through the settle keeps that window on the vsync cadence, exactly what
  // a DevTools Performance recording does when it masks the judder.
  let warmSettleTimer: ReturnType<typeof setTimeout> | null = null;
  // A landing scheduled two frames past COMPLETED (see below). Tracked so a
  // navigation starting inside that window can land it immediately instead of
  // letting it punch into the new flight.
  let pendingLanding: { land: () => void; cancel: () => void } | null = null;

  const landNow = () => {
    if (!pendingLanding) return;
    const { land, cancel } = pendingLanding;
    pendingLanding = null;
    cancel();
    land();
  };
  // The COMPLETED flip's commit is already the convergence frame's busiest
  // moment (status re-renders, freeze of the covered screen); landing the
  // held content there stacks a large reveal commit
  // onto the exact frames the eye is watching settle. Two rAFs put the
  // landing just past the last presented motion frame — visually still "at
  // rest", but off the convergence commit. Without rAF (SSR/jsdom edge) the
  // landing is immediate, which is the old behavior.
  const scheduleLanding = (land: () => void) => {
    if (typeof requestAnimationFrame !== "function") {
      land();
      return;
    }
    let handle = 0;
    const cancel = () => cancelAnimationFrame(handle);
    handle = requestAnimationFrame(() => {
      handle = requestAnimationFrame(() => {
        pendingLanding = null;
        land();
      });
    });
    pendingLanding = { land, cancel };
  };

  const driveScreenLifecycle = (input: ScreenLifecycleInput): (() => void) => {
    const { getElements, transitionName, prevTransitionName, status, isActive, animHoldReleased } =
      input;

    const isTransitional = status === "PUSHING" || status === "POPPING" || status === "REPLACING";

    // Mirror the flight's hold onto Parts that live OUTSIDE any screen, which
    // the compiled hold rule's descendant selector cannot reach (see
    // collectUnheldOuterParts). Owned by the ACTIVE side only: both screens of
    // a flight render a hold, and two owners writing one persistent element
    // means whichever releases first un-holds it for the other. This runs in
    // the binding's layout effect, which re-runs on the hold flip, so the
    // stamp and the screens' own attribute land in the same commit — the part
    // must not lead or trail the flight by a frame either. Stamp and sweep use
    // different predicates on purpose; see collectStampedOuterParts.
    if (isActive) {
      const { scope: holdScope } = getElements();
      if (holdScope) {
        if (isTransitional && !animHoldReleased) {
          for (const part of collectUnheldOuterParts(holdScope, status)) {
            part.setAttribute(ANIM_HOLD_ATTR, "true");
          }
        } else {
          for (const part of collectStampedOuterParts(holdScope)) {
            part.removeAttribute(ANIM_HOLD_ATTR);
          }
        }
      }
    }

    // EVERY flight participant — active or passive, before any early-return
    // fork below (the passive player join returns long before the active
    // path) — gets async image decoding before its tiles paint mid-motion:
    // the one main-thread stall the response/arrival armor cannot reach (see
    // imageDecodeHygiene.ts; device-attributed via the noR tracer gaps). The
    // returning screen of a pop is the passive-fork case exactly.
    if (isTransitional) {
      const { scope: early, bars: earlyBars } = getElements();
      if (early) {
        stampAsyncImageDecode(early);
        // Release a PREVIOUS flight's landing-snap easing stake (this engine
        // instance's only) BEFORE this flight stamps its own: an interrupted
        // snappable slide must not bend a following unsnappable variant's
        // curve. Done once at drive entry — a per-stamp-site else-clear
        // fought the sibling holdParticipantLayers call of the SAME drive
        // (passive-variant pre-stamp vs active stamp) and wiped fresh
        // stamps. Owner-scoped: a no-op without a stake.
        clearInlineAnimation(
          early,
          ["animation-timing-function", "animation-duration"],
          layerOwner
        );
        for (const part of collectScreenParts(early)) {
          clearInlineAnimation(
            part,
            ["animation-timing-function", "animation-duration"],
            layerOwner
          );
        }
        for (const bar of earlyBars ?? []) {
          if (bar)
            clearInlineAnimation(
              bar,
              ["animation-timing-function", "animation-duration"],
              layerOwner
            );
        }
      }
    }

    // Keep the compositor producing frames for as long as this screen is in
    // motion (opening spin-up) AND through the settle window past COMPLETED
    // (the convergence storm) — see warmSettleTimer above.
    if (isTransitional) {
      // Motion judged under DevTools device emulation chases phantoms — warn
      // once (see emulationNotice.ts).
      noticeDeviceEmulationOnce();
      // A navigation starting inside the settle window keeps the SAME hold:
      // cancel the pending release without spending it.
      if (warmSettleTimer) {
        clearTimeout(warmSettleTimer);
        warmSettleTimer = null;
      }
      if (!releaseWarm) releaseWarm = holdCompositorWarm();
    }
    if (!isTransitional && releaseWarm && !warmSettleTimer) {
      if (typeof setTimeout === "function") {
        warmSettleTimer = setTimeout(() => {
          warmSettleTimer = null;
          releaseWarm?.();
          releaseWarm = null;
        }, WARM_SETTLE_MS);
      } else {
        releaseWarm();
        releaseWarm = null;
      }
    }

    // No content landing while the screen is in motion: the COLD side of a
    // navigation (freshly-mounted enter on push/replace, unfreezing pop
    // destination — the screens whose async data can resolve mid-flight)
    // holds in-flight DOM swaps and reflects them at rest. Armed from the
    // FIRST transitional commit, not at the anim-hold release: an earlier
    // policy armed at release on the reasoning that a pre-release landing is
    // invisible (the screen is parked/held) and reflecting it immediately is
    // free — but "free" counted only pixels, not the rendering update. A
    // query's commit task finishing just before the RELEASE frame's vsync
    // joins that frame's rendering update UNHELD, and its full style/layout
    // ages the compiled clock (timestamped at the frame's top) before the
    // flight ever presents — device-measured as the intermittent "gathers
    // then rushes" opening on a multi-query detail push (a timing lottery:
    // the collision needs the commit to land in the release frame itself).
    // Held from the first commit, every arrival in the hold window is
    // display:none (the compiled HELD_ARRIVAL rule) — the release frame can
    // only ever carry cheap, layout-skipped arrivals, and everything lands
    // in ONE commit at rest exactly like a mid-flight arrival always has
    // (the delayed-but-complete contract, now uniform across the whole
    // navigation window).
    const holdsArrivals =
      isTransitional &&
      (isActive ? status === "PUSHING" || status === "REPLACING" : status === "POPPING");

    // The WARM side of the navigation — the screens the arrival hold below
    // never covers (the leaving screen of a push/replace, the leaving top of
    // a pop) — is a MOVING layer too, and an <img> still loading there
    // decodes and first-rasters ON that sliding layer: the list page's lazy
    // avatars spawned by the scroll that preceded this push, or a detail
    // photo resolving during the pop back out of it. Glass-measured
    // (2026-08-18, CDP presentation feedback on the live app with delayed
    // image responses): every such mid-flight decode landed a skipped
    // present, 1:1 — the push-side "뚝뚝" that survived the cold-side hold.
    // So the warm side holds its UNPAINTED images for the flight span too,
    // revealed at rest through the same two-rAF landing scheduler (armed
    // further below). Strictly unpainted-only even under flemo:imghold=on:
    // this screen is VISIBLE, and a painted image must never blink out
    // mid-flight. The RELEASE half runs here, BEFORE the arrival blocks: on
    // an interrupt that flips this screen warm→cold, the arrival arm's own
    // beginImageRevealHold would otherwise capture this hold's display:none
    // as the "original" and re-park the image forever.
    const holdsFlightImages = isTransitional && !holdsArrivals;
    if (!holdsFlightImages && releaseFlightImageHold) {
      const release = releaseFlightImageHold;
      releaseFlightImageHold = null;
      if (isTransitional) {
        // Interrupt: a new flight owns this screen — reveal before its
        // first frame.
        release();
      } else {
        scheduleLanding(release);
      }
    }

    if (!holdsArrivals && releaseArrivalHold) {
      // COMPLETED, IDLE, or an interrupt that flipped this screen's role.
      const release = releaseArrivalHold;
      releaseArrivalHold = null;
      if (isTransitional) {
        // Interrupt: a new transition owns the glass right now — land
        // everything immediately, before its first frame.
        release();
      } else {
        scheduleLanding(release);
      }
    }
    if (holdsArrivals && !releaseArrivalHold && readArrivalHoldFlag()) {
      // A navigation starting inside a still-pending landing window: land it
      // now so the deferred reveal can never punch into the new flight.
      landNow();
      const { scope } = getElements();
      if (scope) {
        // The same cold screens whose commits the hold shields also carry
        // the invisible-animation layer storm (see invisibleAnimationHold.ts)
        // — hold their unseen animations for the same span. And the reveal
        // commits are TRIGGERED by network responses resolving mid-flight
        // (see responseHold.ts — every method; real reveals arrive as GET
        // selects, POST RPCs, and HEAD counts alike): parking those moves the
        // reveal's REACT RENDER — the script cost display:none cannot touch,
        // the player's convergence frame famine — to rest, where the arrival
        // hold was going to reveal its pixels anyway. Never a stream, and
        // bounded by the WHOLE choreography's span (a 3s authored Part must
        // not see parked responses flushed into its middle just because the
        // screen itself lands at 700ms). All releases run together at every
        // consumption path (early/deferred landing, interrupt, re-arm), so
        // content lands, animations resume, and responses deliver in one
        // commit at rest.
        // A NAVIGATION owns its participants (same rule as the player join):
        // conclude any running swipe settle before the compiled flight
        // drives, or it keeps interpolating toward its own target underneath.
        concludeInlineSettle(scope);
        const releaseHold = createArrivalHold(scope);
        const releaseAnimations = createInvisibleAnimationHold(scope);
        const holdSpanMs = statusChoreographySpanMs(
          scope,
          resolveTransition(transitionName),
          status
        );
        const releaseResponses = beginResponseHold(holdSpanMs + GATE_MOTION_MARGIN_MS);
        // Image reveal hold (see imageRevealHold.ts): parks an entering
        // screen's still-loading (and oversized cached) <img> paints to rest
        // so a mid-flight image load OR a re-entry's giant-texture
        // re-composite can't re-raster the sliding layer. OPT-IN on every
        // engine (`flemo:imghold=on`), shipped OFF by default: on WebKit the
        // deferred decode is SYNCHRONOUS at the reveal, which stacks the
        // stall at rest instead of removing it (device: WebKit got worse
        // with the hold on), and the Blink case that motivated it (the
        // Note 9's re-entry swallow) is solved by the auto-gated image
        // decode offloader instead (isLegacyAndroidBlink). The fetch-level
        // responseHold above ships on by default for every engine; this is
        // its <img> analog, retained as a measurement instrument.
        // OPT-IN ONLY (`flemo:imghold=on`). It shipped default-on for the
        // steady-60 desktop profile from 2026-08-18 — the live-app staircase
        // that isolated the F condition ("이미지 로딩 중 전환만 버벅; 캐시된
        // 이미지는 무결") — and the default is retired 2026-08-21 after a
        // desktop A/B rotating the hold per push/pop pair, on a session with
        // images genuinely completing mid-flight, was judged INDISTINGUISHABLE.
        // The touch round the same week measured it as a net loss: it moved
        // ~1.4 in-flight hitches into ~3.6 at the landing, because parking the
        // paint parks the decode with it and the decode still has to happen.
        // The instrument stays for a consumer whose own measurement asks for
        // it; nothing selects it automatically any more.
        const releaseImages =
          readImageHoldFlag() === "on"
            ? beginImageRevealHold(scope, holdSpanMs + GATE_MOTION_MARGIN_MS)
            : noop;
        // The global flight-window latch (see flightWindow.ts): insertion-time
        // machinery outside this drive (the image decode offloader) defers
        // opaque-original reveals to the same rest this release lands.
        const releaseFlightWindow = beginFlightWindow();
        releaseArrivalHold = () => {
          releaseResponses();
          releaseImages();
          releaseAnimations();
          releaseHold();
          releaseFlightWindow();
        };
      }
    }

    if (holdsFlightImages && !releaseFlightImageHold && readArrivalHoldFlag()) {
      // Same protection as the arrival arm: a navigation starting inside a
      // still-pending landing window lands it now, so the deferred reveal
      // can never punch into the new flight.
      landNow();
      const { scope } = getElements();
      // Warm side, same retirement as the arrival arm above: opt-in only.
      if (scope && readImageHoldFlag() === "on") {
        releaseFlightImageHold = beginImageRevealHold(
          scope,
          statusChoreographySpanMs(scope, resolveTransition(transitionName), status) +
            GATE_MOTION_MARGIN_MS,
          true
        );
      }
    }

    // Join this screen's participants (scope, riding bars, decorator) to the
    // navigation's shared player. The player covers every motion — numeric
    // interpolation or a scrubbed Web Animation — so a null here means the
    // player must not or cannot run (Blink, replay chain, css pin, no WAAPI)
    // and the compiled CSS path stays in charge.
    // The display-interval probe. Its samples feed two live consumers — the
    // compiled tier's landing governor (learnedFrameIntervalMs, see
    // landingGovernor.ts) and the steady-60 desktop profile
    // (reportInFlightCadence -> the settle-gate default and the warm-up's
    // cadence lock) — and both need a reading taken IN FLIGHT, while the
    // compositor animation is running: an adaptive panel idles at 60Hz and only
    // shows its true rate once something is animating.
    //
    // The arming used to sit inside the driver-routing gate that sent Blink to
    // the compiled tier. The player is gone and so is that gate, so the arming
    // is kept here on EXACTLY the condition it used to run under: a Blink
    // flight that is not chained behind another pending navigation.
    const armDisplayProbeForFlight = () => {
      if (!detectBlinkEngine()) return;
      const taskId = deps.getTransitionTaskId();
      if (!taskId) return;
      if (TaskManger.pendingTaskIds.some((id) => id !== taskId)) return;
      armDisplayIntervalProbe();
    };

    // Pure-resume wiring for a screen's NON-scope compiled-CSS participants:
    // its riding shared bars (which mirror the screen keyframes), its decorator,
    // and its <Part> elements — each against ITS OWN compiled animation name and
    // timing. No task coupling: a cancel resumes on the original clock, and an
    // exhausted budget or dead element simply stops (the COMPLETED cleanup and
    // rest rules own the pose afterwards). Budgets are per drive-run (a local
    // counter per element), matching the passive scope. Returns the detachers.
    const wireParticipantRecovery = (
      scopeEl: HTMLElement,
      variant: TransitionVariant
    ): (() => void)[] => {
      const detachers: (() => void)[] = [];
      const { decorator, bars } = getElements();
      const transition = resolveTransition(transitionName);

      const wirePure = (element: HTMLElement, expectedName: string, motion: VariantMotion) => {
        let used = 0;
        const controller = wireCancelResume({
          element,
          expectedName,
          motion,
          writer: layerOwner,
          isLive: () => element.isConnected,
          budgetUsed: () => used,
          spendBudget: () => {
            used += 1;
          },
          onTerminal: noop
        });
        controller.attach();
        detachers.push(controller.detach);
      };

      // Riding bars run the screen's own keyframes (the compiler pairs the bar
      // selector with the screen rule), so they share the screen animation name
      // and motion.
      const screenName = animationName("screen", transitionName, variant);
      const screenMotion = resolveVariantMotion(transition, variant);
      if (screenMotion) {
        for (const bar of bars ?? []) {
          if (!bar || bar.getAttribute("data-flemo-bar-riding") !== "true") continue;
          wirePure(bar, screenName, screenMotion);
        }
      }

      if (decorator && transition.decoratorName) {
        const decoratorDefinition = decoratorMap.get(transition.decoratorName);
        const decoratorMotion = decoratorDefinition
          ? resolveVariantMotion(decoratorDefinition, variant)
          : null;
        if (decoratorMotion) {
          wirePure(
            decorator,
            animationName("decorator", transition.decoratorName, variant),
            decoratorMotion
          );
        }
      }

      for (const part of collectVariantParts(scopeEl, variant)) {
        const partName = part.getAttribute(PART_NAME_ATTR)!;
        const definition = partTransitionMap.get(partName);
        const partMotion = definition ? resolveVariantMotion(definition, variant) : null;
        if (!partMotion) continue;
        wirePure(part, animationName("part", partName, variant), partMotion);
      }

      return detachers;
    };

    if (!isActive) {
      // The rAF player writes inline styles on PASSIVE participants too (the
      // exiting screen's parallax, its decorator); the CSS era never needed a
      // passive cleanup because a stopped animation leaves nothing behind.
      // Strip the tracked writes at COMPLETED so the rest rules take over —
      // otherwise the exiting screen stays frozen at its parallax offset
      // under the new top (visible through any transparency, and a stale
      // baseline for the next transition).
      if (status === "COMPLETED") {
        const { scope, decorator, bars } = getElements();
        if (scope) {
          clearInlineAnimation(scope);
          for (const part of collectScreenParts(scope)) clearInlineAnimation(part);
        }
        if (decorator) clearInlineAnimation(decorator);
        for (const bar of bars ?? []) {
          // Bars are the one participant class SHARABLE across drivers (an
          // engine flight and a swipe both promote riding bars), so their
          // COMPLETED cleanup releases only THIS engine's stakes — the
          // player's per-track writer and a swipe's own token clean up on
          // their own paths. Scope and decorator are never shared: force.
          if (bar) clearInlineAnimation(bar, undefined, layerOwner);
        }
        // The pop-returning screen is the visible top from here on — its
        // participants' layers demote off-cadence, past the convergence
        // commits (see layerSettleHold.ts). clearInlineAnimation never
        // touches the stamps (will-change/contain are not tracked writes),
        // so the order is free.
        releaseParticipantLayers({ scope, decorator, bars: bars ?? [] }, layerOwner);
        return noop;
      }
      // A prev screen entering a differently-transitioned replace flips the
      // replace-transition status so its own rules can resolve in step.
      const isTransitionDiffOnReplace = prevTransitionName !== transitionName;
      if (status === "REPLACING" && isTransitionDiffOnReplace) {
        deps.setReplaceTransitionStatus("PENDING");
      }
      // Pin this side's compiled promotions inline for the flight (see
      // layerSettleHold.ts), so the COMPLETED flip's rule un-match cannot
      // demote-and-repaint any participant's layer on the convergence
      // frames. Stamped from the FIRST transitional effect — the rules
      // promote from the same commit.
      if (isTransitional) {
        const { scope, decorator, bars } = getElements();
        if (scope) {
          holdParticipantLayers(
            { scope, decorator, bars: bars ?? [] },
            resolveTransition(transitionName),
            `${status}-false` as TransitionVariant,
            layerOwner
          );
        }
      }
      // The passive side of the transition (exiting screen on push, returning
      // screen on pop). The compiled CSS drives this exit; wire cancel-resume on
      // every participant so a WebKit-cancelled fade rejoins its timeline
      // instead of dying silently under the incoming top. Pure resume — the
      // passive side has no task to resolve; when a budget or the element's
      // life is exhausted it just stops.
      if (isTransitional && animHoldReleased) {
        const variant = `${status}-false` as TransitionVariant;
        armDisplayProbeForFlight();

        const { scope } = getElements();
        if (scope) {
          const transition = resolveTransition(transitionName);
          const detachers: (() => void)[] = [];
          if (variantHasAnimation(transition, variant)) {
            // variantHasAnimation and resolveVariantMotion share the same gate
            // (a non-rest variant with duration or delay > 0 — see
            // variantMotion.ts), so the assertion can never fire.
            const motion = resolveVariantMotion(transition, variant)!;
            let used = 0;
            const controller = wireCancelResume({
              element: scope,
              expectedName: animationName("screen", transitionName, variant),
              motion,
              writer: layerOwner,
              isLive: () => scope.isConnected && scope.getAttribute(SKIP_ANIMATION_ATTR) !== "true",
              budgetUsed: () => used,
              spendBudget: () => {
                used += 1;
              },
              onTerminal: noop
            });
            controller.attach();
            detachers.push(controller.detach);
          }
          detachers.push(...wireParticipantRecovery(scope, variant));
          if (detachers.length > 0) return () => detachers.forEach((detach) => detach());
        }
      }
      return noop;
    }

    if (status === "COMPLETED") {
      // A probe still mid-window at the flip would go on to sample post-flight
      // idle gaps — discard it (see cancelDisplayIntervalProbe).
      cancelDisplayIntervalProbe();
      deps.setDragStatus("IDLE");
      deps.setReplaceTransitionStatus("IDLE");
      // Strip inline styles a swipe, the rAF player, or an interleaved
      // navigation may have left on this screen and its related elements, so
      // the next push/pop runs against the compiled CSS rest rule on a clean
      // slate.
      const { scope, decorator, bars } = getElements();
      if (scope) {
        clearInlineAnimation(scope);
        // The force clear above releases LEASED properties, but a pose channel
        // can be ABSENT from the lease map at this exact instant: the player
        // track's own detach (this same commit's effect cleanup) already
        // released its transform stake — restoring the lease "original", which
        // for the actively-entered scope is the entering-initial from-pose the
        // binding rendered (flemo's own transient write, not a consumer value)
        // — and dropped the entry. When ANOTHER lease survives into this
        // commit (the governed easing stamp, released later by
        // releaseParticipantLayers below), the keyed iteration in the force
        // clear never visits the now-untracked pose and the empty-map fallback
        // never runs — device-reproduced on desktop Blink as a re-entry
        // parking the landed screen at translate3d(100%) (a blank viewport).
        // The landed scope's pose belongs to the compiled rest rules
        // unconditionally, so strip the two pose channels explicitly; the
        // explicit-list force form removes untracked properties by contract.
        clearInlineAnimation(scope, ["transform", "opacity"]);
        scope.removeAttribute(SKIP_ANIMATION_ATTR);
        for (const part of collectScreenParts(scope)) clearInlineAnimation(part);
      }
      if (decorator) {
        clearInlineAnimation(decorator);
        decorator.removeAttribute(SKIP_ANIMATION_ATTR);
      }
      for (const bar of bars ?? []) {
        // Owner-scoped for the same reason as the passive side: bars are the
        // one participant class sharable across drivers.
        if (bar) clearInlineAnimation(bar, undefined, layerOwner);
      }
      // The just-landed screen — and its decorator, riding bars, and parts —
      // keep their compositor layers through the convergence window and
      // demote off-cadence (see layerSettleHold.ts): the demote repaints
      // were the full-viewport paint flash landing exactly on the frames the
      // eye watches settle. Swipe-promoted bar layers ride the same clock
      // (their inline promotion previously dropped IN this commit).
      releaseParticipantLayers({ scope, decorator, bars: bars ?? [] }, layerOwner);
      return noop;
    }

    if (status === "IDLE") return noop;

    const { scope } = getElements();
    if (!scope) return noop;

    // NOTE (consumer animation pause, REMOVED 2026-08-18): a flight-scoped
    // pause of running consumer CSS animations (skeleton pulses) was tried
    // here for steady-60 desktops and removed the same day on the user's
    // direction — flemo does not manipulate consumer-authored animation
    // state, and the pause measurably didn't cure the felt jank anyway.

    // The task this transition gates, captured HERE (never the live one — a
    // late resolver must not cut a NEWER transition). Shared by the resolver,
    // the liveness floor, the recovery watchdog, and the active-scope resume
    // budget.
    const flooredTaskId = deps.getTransitionTaskId();

    // Released when the flight resolves or is torn down (see armFramePacingKeepalive).
    let stopKeepalive = noop;
    const resolve = () => {
      stopKeepalive();
      // Resolve THIS flight's captured task, never the live one. Reading the
      // live id let a STALE resolver (a previous flight's animationend/cancel
      // firing a frame into the NEXT flight) resolve whatever task is now
      // current — the new flight's — flipping data-flemo-status to COMPLETED at
      // the exact frame the new flight releases its hold. The compiled
      // @keyframes rule matches on `[data-flemo-status="PUSHING"]`, so that flip
      // un-matches the just-started animation and cancels it mid-opening: the
      // slide is swallowed while the navigation still commits (device: "연타할
      // 때 트랜지션이 씹히고 전환된다", desktop Blink compiled tier, ~50% of
      // rapid pushes). `resolveTask` is already a no-op on a non-current task,
      // so a stale resolver now settles only its own (already-done) task and
      // can never cut a newer flight — exactly what the flooredTaskId capture
      // was for (see its comment above).
      if (flooredTaskId) {
        void TaskManger.resolveTask(flooredTaskId);
        // The task is settling — drop its resume-budget entry so the map only
        // ever holds the handful of genuinely in-flight tasks.
        activeResumeCounts.delete(flooredTaskId);
      }
    };

    const currentTransition = resolveTransition(transitionName);
    const variantKey = `${status}-true` as const;
    const skipAnimation = scope.getAttribute(SKIP_ANIMATION_ATTR) === "true";
    const hasAnimation = !skipAnimation && variantHasAnimation(currentTransition, variantKey);

    // Pin the compiled rules' promotions inline for the flight (see
    // layerSettleHold.ts): the COMPLETED flip un-matches the variant rules
    // in its own commit, and on Blink each demotion repaints its element
    // right on the convergence frames. Gated on skipAnimation only — the
    // helper gates every participant (screen, riding bars, decorator, parts)
    // on its OWN definition's animation, so a REVEAL-shaped active screen
    // still pins its animating decorator and parts.
    if (!skipAnimation) {
      const { decorator, bars } = getElements();
      holdParticipantLayers(
        { scope, decorator, bars: bars ?? [] },
        currentTransition,
        variantKey,
        layerOwner
      );
    }

    // Steady Chrome's ProMotion frame pacing for the compositor-driven flight
    // (see armFramePacingKeepalive) — compiled Blink only, where the idle main
    // thread otherwise lets the presentation drop/duplicate frames. Released in
    // resolve() and the teardown below.
    const compiledBlinkFlight =
      hasAnimation &&
      detectBlinkEngine() &&
      ((typeof navigator !== "undefined" && navigator.maxTouchPoints === 0) ||
        learnedFrameIntervalMs() < COMPILED_TIER_MAX_INTERVAL_MS);
    if (compiledBlinkFlight) stopKeepalive = armFramePacingKeepalive();

    // Every participant of this STATUS with a registered motion — the passive
    // screen variant plus both screens' parts (parts self-carry their variant
    // attributes). Computed up front because EVERY deadline must derive from
    // the whole choreography's span, not just the active screen's: the task
    // gate, the liveness floor, and the choreography-span deferral all cut a
    // longer-authored participant if they assume the active span.
    const passiveVariantKey = `${status}-false` as TransitionVariant;
    const passiveMotion = variantHasAnimation(currentTransition, passiveVariantKey)
      ? resolveVariantMotion(currentTransition, passiveVariantKey)
      : null;
    const statusPartMotions: { element: HTMLElement; motion: VariantMotion }[] = [];
    for (const part of collectFlightParts(scope, status)) {
      const definition = partTransitionMap.get(part.getAttribute(PART_NAME_ATTR)!);
      const partVariant =
        `${status}-${part.getAttribute("data-flemo-active")}` as TransitionVariant;
      const partMotion =
        definition && variantHasAnimation(definition, partVariant)
          ? resolveVariantMotion(definition, partVariant)
          : null;
      if (partMotion) statusPartMotions.push({ element: part, motion: partMotion });
    }
    let participantSpanMs = passiveMotion
      ? (passiveMotion.delay + passiveMotion.duration) * 1000
      : 0;
    for (const { motion } of statusPartMotions) {
      participantSpanMs = Math.max(participantSpanMs, (motion.delay + motion.duration) * 1000);
    }
    // The decorator participates on the same clock (it joins the player), so
    // the gate, the liveness floor, the choreography-span deferral, the
    // perceptual cut, and the early landing must all cover its span too — a
    // longer-authored dim was previously cut at the screen's own COMPLETED.
    const statusDecoratorMotions: VariantMotion[] = [];
    {
      const decoratorDefinition = currentTransition.decoratorName
        ? decoratorMap.get(currentTransition.decoratorName)
        : undefined;
      if (decoratorDefinition) {
        for (const decoratorVariant of [
          `${status}-true`,
          `${status}-false`
        ] as TransitionVariant[]) {
          if (!variantHasAnimation(decoratorDefinition, decoratorVariant)) continue;
          const motion = resolveVariantMotion(decoratorDefinition, decoratorVariant);
          if (motion) {
            statusDecoratorMotions.push(motion);
            participantSpanMs = Math.max(
              participantSpanMs,
              (motion.delay + motion.duration) * 1000
            );
          }
        }
      }
    }

    if (!hasAnimation) {
      // A REVEAL-shaped transition: the active entering screen stands still
      // (its enter is visually a no-op) while the PASSIVE side animates out
      // above it — the transition's whole visible motion lives on the exit.
      // Resolving on a microtask here would complete the task instantly and
      // cut that exit off, so the task spans the passive variant's motion
      // instead: armed at the hold release (a heavy pre-release commit then
      // DELAYS the span, never truncates it), plus a small margin so the exit
      // lands its final frame before the COMPLETED flip re-renders both
      // screens. The engine watchdogs still net a lost exit animation.
      if (!skipAnimation) {
        // Gate on the WHOLE choreography, not just the passive screen: a
        // transition whose screens stand still while a Part or the decorator
        // animates must span that motion too, not resolve on a microtask.
        if (participantSpanMs > 0) {
          if (!animHoldReleased) {
            // Wait for the release commit; this effect re-runs with
            // animHoldReleased=true and arms the span then.
            if (flooredTaskId) TaskManger.markGateHeld(flooredTaskId);
            return noop;
          }
          const spanMs = participantSpanMs + 50;
          // Anchor with the choreography's own span so the gate can never cut
          // an authored motion (see TaskManger.anchorGate).
          if (flooredTaskId) TaskManger.anchorGate(flooredTaskId, spanMs + GATE_MOTION_MARGIN_MS);
          const spanTimer = setTimeout(resolve, spanMs);
          return () => clearTimeout(spanTimer);
        }
      }
      // No animation anywhere in this variant pair. Resolve in a microtask so
      // the binding's commit lands first and the navigation queue keeps
      // advancing.
      queueMicrotask(resolve);
      return noop;
    }

    // Report the transition gate's phase for this task. The gate backstop's
    // clock starts at the PARK (tap time), but a long entering-commit block can
    // eat that whole window before the motion begins — firing then would flip
    // the store to COMPLETED and snap the transition away (the "delay then
    // transition-less cut"). While the hold is still on, the backstop re-arms
    // instead of firing; the release anchors a FRESH window so a late-starting
    // transition always gets its full motion span. Both calls are idempotent
    // and safe pre-park (TaskManger keeps the phase until the task settles).
    const activeMotion = resolveVariantMotion(currentTransition, variantKey);

    if (flooredTaskId) {
      if (animHoldReleased) {
        // Anchor with the authored motion's own span: the gate default
        // assumed no transition outlives ~1.2s and silently CUT longer
        // authored motions at the backstop (measured: a 3s cupertino snapped
        // to rest at ~1.2s). The margin mirrors the liveness floor's.
        // Past the `hasAnimation` early return the motion always resolves
        // (variantHasAnimation and resolveVariantMotion share the same gate
        // — see the liveness floor below).
        const motionMs = (activeMotion!.delay + activeMotion!.duration) * 1000;
        TaskManger.anchorGate(
          flooredTaskId,
          Math.max(motionMs, participantSpanMs) + GATE_MOTION_MARGIN_MS
        );
      } else {
        TaskManger.markGateHeld(flooredTaskId);
      }
    }
    const hasDrivableMotion = !skipAnimation && !!activeMotion;

    // Native-clock SURGERY opt-in (first-frame hold, flight-start anchor,
    // stall re-anchoring): authored `driver: "native"` pins only. Every one
    // of these mutates a running animation's timing (WAAPI pause/play,
    // startTime shifts), and the 2026-08 iPhone falsification series
    // established that on WebKit any such touch costs the accelerated
    // (out-of-process) path or desyncs its re-sync — the routed non-Blink
    // default therefore runs the compiled animation UNTOUCHED and protects
    // the opening by release scheduling (paint-anchored anim-hold + the
    // entry content-settle gate) instead. An author who pins "native" takes
    // the main-thread-presentation trade knowingly, and for them the anchors
    // remain the right medicine.
    const nativeSurgeryAllowed =
      (currentTransition as { driver?: string }).driver === "native" && !detectBlinkEngine();
    // Governed-tier flights supervise with plain startTime rewinds only (the
    // R30-verified birth anchor + the stall watcher). The pause/play
    // first-frame hold stays authored-native-only (falsified: it costs
    // WebKit's accelerated representation), and the two-phase hold with
    // pending-clock pins is on the do-not-reattempt list.
    const routedTouchGoverned =
      !detectBlinkEngine() &&
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 0 &&
      governedCompiledActive();
    // The governed head kit for touch Blink: a slow device's commits age a
    // BARE compiled flight's clock past the whole opening (the Note 9
    // profile: 120-260ms mount tasks), so the flight gets a held head instead
    // of swallowing the curve's start.
    //
    // Known gap, deliberately not closed here: a modern-but-weak touch Blink
    // (UA-CH present, so not legacy) used to earn this kit through the driver
    // demotion machinery, which is gone. The render-settle gate covers the same
    // mount weight from the other side, default-on for touch Blink since #268.
    // Extending the kit to ALL touch Blink is the obvious next lever and must
    // NOT be taken blind: the 2026-08-14 round reverted exactly that blanket
    // treatment when fast devices picked up the compiled landing snap (see
    // docs/postmortems/2026-08-motion-jank.md). It needs a device round.
    const routedBlinkGoverned =
      detectBlinkEngine() &&
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 0 &&
      isLegacyAndroidBlink();
    // Unified-WebKit experiment: all touch WebKit on the compiled tier takes
    // the governed head kit too, so its opening commit lands in a held head
    // instead of swallowing the curve's start.
    const routedForceCompiled =
      !detectBlinkEngine() &&
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 0 &&
      forceCompiledStatus(status);
    const routedGovernedHead = routedTouchGoverned || routedBlinkGoverned || routedForceCompiled;
    // The DESKTOP head (`flemo:deskhead`): desktop macOS Safari runs the same
    // compiled clock as the touch tier and presents it from the main thread, so
    // it gets the same active-from-birth cover — its own lengths (see
    // DESKTOP_HEAD_MS), its own gate attribute, and, like the touch tier, NO
    // clock surgery beside it: arming this retires the birth anchor below.
    const routedDesktopHead = isDesktopMacWebKit() && readDesktopHeadFlag();
    // First-frame clock hold (see nativeStallAnchor): armed from the
    // engine's own observer, whatever the hold state at effect time — React
    // effect scheduling races both the release commit and its render pass,
    // which are exactly the blocks being compensated. The module's
    // fresh/pending gate makes re-arming across effect re-runs a no-op.
    // Captured so the effect cleanup can tear it down: the hold owns a
    // MutationObserver, a pending rAF, a resume backstop, AND a
    // document-wide early stall watcher that traverses the NEXT flight's
    // animations for up to 3s if left running. An interrupt/unmount must
    // stop all of it, not leak it into the following navigation.
    // Birth anchor for DESKTOP non-Blink compiled flights (macOS Safari — the
    // 1.23.0 gate, briefly lost in a refactor and eye-caught as the compiled
    // tier turning "whooshy": without it the release block's clock aging
    // swallows the opening). Armed at the PRE-release run so its observer
    // catches the anim-hold release in the microtask ahead of the release
    // block's rendering update. ONE-SHOT rewind form only (holdFirstFrame=
    // false): the R30-verified clock intervention on DESKTOP WebKit.
    //
    // TOUCH WebKit (the governed tier and the routed-force-compiled one) is
    // EXCLUDED, the same as the governed tier below: R30 verified this rewind on desktop glass, but a
    // touch iPhone's out-of-process accelerated animation treats ANY startTime
    // write on a running clock as a re-sync trip — device-reported as the
    // compiled tier intermittently CUTTING a push straight to its end. Touch
    // protects the opening by pure STYLE instead (the governed flat-head, see
    // routedGovernedHead), never by surgery. Blink stays excluded too: its
    // compositor plays through main-thread stalls, where a rewind would yank a
    // smooth animation backwards.
    let detachGovernedBirthAnchor: (() => void) | null = null;
    if (
      hasDrivableMotion &&
      !detectBlinkEngine() &&
      !nativeSurgeryAllowed &&
      !routedTouchGoverned &&
      !routedForceCompiled &&
      // The desktop head covers this flight by STYLE. Rewinding the clock
      // underneath it would correct a latency the head has already covered —
      // two interventions on one clock, which is the pairing the touch tier
      // was built to avoid.
      !routedDesktopHead
    ) {
      detachGovernedBirthAnchor = armFlightStartAnchorAtRelease(
        scope,
        () => [scope.ownerDocument.documentElement],
        () => startHoldDisarms.get(scope)?.(),
        false
      );
    }
    // Governed-tier flights run the compiled animation COMPLETELY untouched — not even
    // the birth anchor. Device-falsified in sequence (iPhone LPM 2026-08):
    // the co-flush watch's capped-rAF eyes rewound healthy flights (backward
    // jump every push, up to 570dpx), and the corrected first-tick-only
    // rewind is still a WAAPI startTime write on a running animation — the
    // intervention class the falsification series implicated for WebKit's
    // accelerated (out-of-process) path. The opening protection is pure
    // STYLE instead: the compiled rules read --flemo-gov-birth-hold into
    // animation-delay (see compileTransitionStyles), and this pre-release
    // write predicts the release→first-present latency (two frames of the
    // measured cadence — style resolution tops the release update, its
    // paint and the compositor commit land 2-3 capped frames later) so the
    // clock's zero rides forward to the first frame the user actually sees.
    // fill-mode backwards holds the authored from-pose across the shifted
    // span — the very pose the anim-hold already shows, so nothing changes
    // on glass except that the curve now PLAYS from 0 instead of being
    // entered 25-40% in (the device-reported "starts at 60" jump). The var
    // is synced both ways so a tier change never leaves a stale delay.
    //
    // STATUS-SPLIT prediction, frame-stepped from the 60fps screen-recording
    // round (iPhone LPM 2026-08-12): a push's release update co-flushes the
    // reveal render, so its first present lands 60-130ms into the clock —
    // the 2-frame guess (66ms) under-covered it and the recording still
    // showed a first-frame mega-stride at ~25% of travel (2.2x the energy
    // of the frame after it), with everything past it presenting smooth
    // 60fps. Four frames pairs with the LPM content-settle gate (see
    // ScreenMotion): the gate keeps ANY page's release update light — a
    // shell screen waits for its content wave before the release — so the
    // static hold only needs to cover the light update's pipeline latency,
    // uniformly. (A six-frame hold WITHOUT the gate was tried against the
    // lawmaker-detail stutter and still lost to that screen's release
    // weight; the adaptive extension was falsified outright — see the
    // retired-guard note below.) A pop has no reveal to
    // co-flush — the same recording shows pops entering their curve at the
    // authored pose with the 2-frame hold — and it is the most
    // latency-sensitive gesture, so it keeps the smaller hold rather than
    // paying 66ms more of reaction time it measurably doesn't need.
    // ENTRY holds (PUSHING/REPLACING) use the static GOVERNED_HEAD_MS table.
    // An adaptive version sized from a measured release-latency ledger was
    // built and retired unread (2026-08-19): the probe fed a ledger nothing
    // consumed, so the "adaptive" hold was always the static guess. POPPING
    // keeps the small hold — its release is measured clean and it is the
    // most latency-sensitive gesture.
    // Deadline offsets ONLY: the visual hold lives in the gated flat-head
    // keyframes (compileTransitionStyles.GOVERNED_HEAD_MS — same numbers). No
    // inline timing is written anywhere: static CSS cannot miss a
    // late-mounting participant the way the inline stamping missed the
    // decorator (device 2026-08-13: the dim faded in ahead of the held
    // screens).
    const governedBirthHoldMs = routedGovernedHead
      ? (GOVERNED_HEAD_MS[status] ?? 0)
      : routedDesktopHead
        ? (DESKTOP_HEAD_MS[status] ?? 0)
        : 0;
    // The LPM duration stretch (see compileTransitionStyles). Device-tuned
    // 2026-08-12: the cadence-ratio stretch (~2.2x) played the whole 0-100
    // and proved the pipeline, but was judged too slow — the standing
    // directive is PLAYER-IDENTICAL duration, so the factor rests at 1
    // (vars unset, compiled rules fall back to authored timing). The
    // machinery stays: one constant re-arms it if the trade is ever
    // re-judged.
    // Slides stay player-identical (the 2.2x whole-flight stretch was
    // device-rejected as too slow); REPLACING alone stretches 1.5x under
    // LPM (user-selected configuration C, 2026-08-13): a tab fade is so
    // short that governor-throttle aging past the hold consumed half of
    // it — at 1.5x the same residual dilutes below perceptibility while
    // the fade stays a fade.
    // ABSOLUTE slack, not a fixed multiplier (the multiplier was tuned to
    // plen's 200ms fade and would double a user-authored 1s REPLACING for
    // no reason): the aging residual being diluted is an absolute quantity,
    // so the stretch adds ~one entry-hold's worth of span to the authored
    // duration whatever that duration is, clamped so a tiny authored fade
    // can never balloon.
    // REPLACING stretch retired with the delay-hold: the flat-head
    // keyframes carry their own literal total duration.
    const governedStretch = 1;
    // A SLIDE on the governed touch tier. It stands the wall-clock
    // accelerators down for the same reason routedForceCompiled does — see
    // the cut block below — and it covers one case that predicate does not:
    // a touch-WebKit PUSH in a session that has turned the settle gate off.
    //
    // Its name used to be `governedSoftenActive`, from the front-softening
    // treatment it was introduced alongside. That treatment was retired in
    // 2026-08-13 and deleted with the rAF player; this gate outlived it
    // because what it actually guards is the clock, not the curve.
    const governedSlide = routedTouchGoverned && (status === "PUSHING" || status === "POPPING");
    {
      const root = scope.ownerDocument.documentElement;
      const creepHeadProbe = routedGovernedHead && readCreepHeadFlag();
      if (creepHeadProbe) root.setAttribute("data-flemo-creep", "true");
      else root.removeAttribute("data-flemo-creep");
      if (routedGovernedHead) {
        root.setAttribute("data-flemo-governed", "true");
      } else {
        root.removeAttribute("data-flemo-governed");
      }
      // The desktop gate is the same mechanism one attribute over: a session is
      // either touch (LPM) or desktop Mac, never both, and the two heads carry
      // different literal lengths.
      if (routedDesktopHead) {
        root.setAttribute("data-flemo-desk-head", "true");
      } else {
        root.removeAttribute("data-flemo-desk-head");
      }
    }
    // (RETIRED 2026-08-12, same day: the ADAPTIVE birth-hold guard —
    // post-release extensions of the hold var. Frame-stepped falsification:
    // WebKit's accelerated animation counts its delay down in the UI
    // process, which keeps presenting through the very main-thread block
    // the guard was measuring — by the time the extension committed, the
    // UI side had already played the first motion frames, and the larger
    // delay snapped them BACK to the from-pose before restarting
    // (device-seen as the tab switch's old-screen flash and the push
    // stutter). The hold must be fully decided BEFORE the animation is
    // born; after birth, no timing write of any kind is safe.)
    let detachFirstFrameHold: (() => void) | null = null;
    if (hasDrivableMotion && nativeSurgeryAllowed) {
      detachFirstFrameHold = holdNativeClocksToFirstFrame(
        scope,
        () => [scope.ownerDocument.documentElement],
        () => startHoldDisarms.get(scope)?.()
      );
    }

    // The `animationend` listener is the ALWAYS-WIRED resolver — attached from
    // the first transitional render, whatever the driver. This is what
    // resolves the navigation's manual task, and the manual task's completion
    // is what commits the store move (a pop's `popHistory` decrements `index`
    // and trims the stack). If the ONLY resolver were the rAF player's
    // onComplete, a transition torn down or superseded before the player runs
    // (a back/forward storm freezing the leaving screen mid-hold) would strand
    // its manual task forever — `pendingIndex` and `index` lock to different
    // entries and the sidebar (reads pendingIndex) desyncs from the URL and
    // content (read index). The compiled animation stays PAUSED during the
    // hold, so this never fires early; when the player joins it suppresses the
    // compiled animation (animation: none), so `onEnd` simply never fires and
    // the player's onComplete resolves instead — never a double, and never a
    // gap where nothing is wired to resolve.
    const expectedName = animationName("screen", transitionName, variantKey);

    // Compiled-CSS liveness recovery state (see the recovery block below the
    // player join). Declared up here so the always-wired `animationend`
    // resolver clears the watchdog the instant the animation finishes cleanly.
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const clearWatchdog = () => {
      if (watchdog === undefined) return;
      clearTimeout(watchdog);
      watchdog = undefined;
    };

    // The whole choreography's span can outlive the ACTIVE screen's own
    // motion: a passive side or a <Part> with a longer registered duration
    // was, until now, truncated mid-flight by the COMPLETED flip at the
    // active animationend — visible as the part snapping right at the
    // convergence (measured: a 0.6s part riding a 0.35s material screen cut
    // at 58% of its motion). A CLEAN end now defers the task resolution by
    // the difference (bounded below the liveness floor), so the full
    // choreography plays; recovery paths (watchdog terminal, floor) still
    // resolve immediately — something is already wrong there.
    let choreographyExtraMs = 0;
    let choreographyTimer: ReturnType<typeof setTimeout> | undefined;
    // The COMPLETED flip's commit is the convergence frame's busiest moment
    // (status re-renders, the covered screen's freeze, the animation strip +
    // re-layerize), and resolving it in the same beat as the motion's last
    // frame measured as a dropped frame right at landing (production trace:
    // smoothness-affecting drop ~32ms after animationend, TimerFire → flip
    // commit at the final frame). A CLEAN end therefore lets that frame
    // PRESENT first: two rAFs — the same anchor the hold uses — with a
    // timeout fallback for suspended rAF (background tab). The screen holds
    // its arrival pose under the compiled rules meanwhile, so the deferral is
    // invisible. Recovery paths (watchdog, floor, resume-terminal) keep
    // resolving immediately — something is already wrong there.
    let landingClearFrames: number[] = [];
    let landingClearFallback: ReturnType<typeof setTimeout> | undefined;
    const cancelLandingClear = () => {
      landingClearFrames.forEach((frame) => cancelAnimationFrame(frame));
      landingClearFrames = [];
      if (landingClearFallback !== undefined) clearTimeout(landingClearFallback);
      landingClearFallback = undefined;
    };
    const resolvePresented = () => {
      /* v8 ignore next 4 -- every runtime under test has rAF; the guard
         shields exotic embedders. */
      if (typeof requestAnimationFrame !== "function") {
        resolve();
        return;
      }
      landingClearFallback = setTimeout(() => {
        cancelLandingClear();
        resolve();
      }, LANDING_CLEAR_FALLBACK_MS);
      const chain = (remaining: number) => {
        if (remaining <= 0) {
          cancelLandingClear();
          resolve();
          return;
        }
        landingClearFrames.push(requestAnimationFrame(() => chain(remaining - 1)));
      };
      chain(LANDING_CLEAR_FRAMES);
    };
    const resolveAfterChoreography = () => {
      if (choreographyExtraMs <= 0) {
        resolvePresented();
        return;
      }
      choreographyTimer = setTimeout(resolvePresented, choreographyExtraMs);
    };

    // Detaches the scope's own cancel-resume + watchdog. Set once the recovery
    // is wired (below); a no-op until then and when the player drives. Called
    // on a clean end so a late stray cancel can't resolve a second time.
    let stopScopeRecovery = noop;
    // Disarms the perceptual completion cut (wired below): any recovery event
    // shifts real presentation later than the wall clock, so the cut must
    // yield to animationend.
    let disarmPerceptualCut = noop;
    const onEnd = (event: AnimationEvent) => {
      if (event.target !== scope) return;
      // Same-flight match across every head tier's suffixed keyframe name: a
      // miss here does not just skip a resolve, it strands the flight until
      // the restart watchdog replays it.
      if (!matchesFlightAnimationName(event.animationName, expectedName)) return;
      scope.removeEventListener("animationend", onEnd);
      clearWatchdog();
      stopScopeRecovery();
      resolveAfterChoreography();
    };
    scope.addEventListener("animationend", onEnd);

    // Sample the display cadence, once the hold has released and the compiled
    // animation is actually running (see armDisplayProbeForFlight).
    if (hasDrivableMotion && animHoldReleased) armDisplayProbeForFlight();

    // Liveness FLOOR — the guarantee that the manual task ALWAYS resolves. A
    // rapid back/forward storm can orphan or freeze the element this transition
    // animates (a nested Router remounts, Activity freezes the leaving top)
    // before its `animationend` reaches the listener. Then the manual task
    // strands forever: its completion never commits `index`, so the content
    // locks a step behind the URL, AND the serial task queue DEADLOCKS behind
    // it — every later navigation stalls (the "content never reaches the URL"
    // and, once anything reads the stuck queue depth, the "no animation"
    // cascade). The floor resolves the taskId captured HERE (never the live one
    // — a late floor must not cut a NEWER transition) after the motion is
    // GENEROUSLY over: the hold ceiling + duration + a wide margin, so a
    // healthy transition always resolves via animationend/player first and only
    // a genuinely stranded one hits the floor. `resolveTask` is a no-op on an
    // already-resolved id.
    // Past the `hasAnimation` early return the motion ALWAYS resolves:
    // variantHasAnimation and resolveVariantMotion share the same gate (a
    // non-rest variant with duration or delay > 0 — see variantMotion.ts), so
    // the assertion can never fire. One span, shared by the liveness floor and
    // the recovery watchdog below.
    const motionSpanMs = (activeMotion!.delay + activeMotion!.duration) * 1000;
    // The floor outlives the WHOLE choreography (a part may be authored
    // longer than its screen), plus the recovery margin.
    const settleMs = Math.max(motionSpanMs, participantSpanMs) + 1500;
    const floor = flooredTaskId
      ? setTimeout(() => void TaskManger.resolveTask(flooredTaskId), settleMs)
      : undefined;

    // Every participant of this STATUS with a registered motion — the passive
    // screen variant plus both screens' parts (parts self-carry their variant
    // attributes) — shared by the choreography-span deferral above and the
    // perceptual cut below.
    // The extra is UNCAPPED: it is bounded by the authored spans themselves,
    // and every deadline below (gate, floor) scales with the same
    // choreography span — a fixed cap here was one more hidden "no authored
    // motion outlives N" assumption, cutting any part more than a second
    // longer than its screen.
    choreographyExtraMs = Math.max(0, participantSpanMs - motionSpanMs);

    // Animation-signal loss recovery for the COMPILED-CSS path only. When the
    // rAF player drives, its own onComplete resolves and the join's
    // `animation: none` would itself fire a spurious `animationcancel`, so this
    // arms only when the player is NOT the driver AND the hold has released (a
    // paused, held animation is not lost — nothing to recover, and the watchdog
    // must never fire against a legitimate pause). On WebKit a screen animation
    // the browser silently cancels mid-flight (a data/suspense commit racing
    // the transition) fires NEITHER `animationend` nor a player onComplete.
    //
    // Two independent mechanisms cover the two ways the signal is lost:
    //   1. CANCEL-RESUME: the browser fired `animationcancel`. We resume the
    //      animation on its ORIGINAL timeline (wireCancelResume), up to
    //      RESUME_BUDGET times, so a suspended-mount commit re-invalidating the
    //      layer can't kill the transition — it keeps rejoining and ends on
    //      schedule via `animationend`. Only when the budget is spent (or the
    //      element goes dead) does it concede and resolve.
    //   2. WATCHDOG full-restart: NO signal at all arrived by the deadline (the
    //      animation never started, or a resume's own end was lost too). One
    //      full replay from `from` on a fresh clock, re-armed once, then
    //      resolve — the two-window semantics unchanged from before. A
    //      cancel-resume must NOT touch the watchdog: a resumed animation ends
    //      on the original schedule, so the original deadline stays valid and
    //      `animationend` clears it.
    // The liveness floor above and the 1.2s task gate remain untouched last
    // resorts.
    // The LPM stretch multiplies the real animation span, so every deadline
    // derived from authored time rides with it (birth hold included).
    const restartWatchdogMs = motionSpanMs * governedStretch + governedBirthHoldMs + 250;

    // Whether this scope's recovery may still act. Requires a live task id (no
    // task → nothing to gate or resolve), THIS transition still current, the
    // element connected, no committed swipe, and a genuinely animating variant.
    const scopeIsLive = () =>
      flooredTaskId !== null &&
      deps.getTransitionTaskId() === flooredTaskId &&
      scope.isConnected &&
      scope.getAttribute(SKIP_ANIMATION_ATTR) !== "true" &&
      variantHasAnimation(currentTransition, variantKey);

    const scopeResume = wireCancelResume({
      element: scope,
      expectedName,
      motion: activeMotion!,
      writer: layerOwner,
      isLive: scopeIsLive,
      // Both callbacks run only past `isLive` (wireCancelResume consults the
      // budget after the short-circuit), and scopeIsLive requires a live task
      // id — so the assertions can never fire.
      budgetUsed: () => activeResumeCounts.get(flooredTaskId!) ?? 0,
      spendBudget: () => {
        disarmPerceptualCut();
        activeResumeCounts.set(flooredTaskId!, (activeResumeCounts.get(flooredTaskId!) ?? 0) + 1);
      },
      onTerminal: resolve
    });
    stopScopeRecovery = scopeResume.detach;

    let watchdogRestarted = false;
    const armWatchdog = () => {
      clearWatchdog();
      watchdog = setTimeout(onWatchdog, restartWatchdogMs);
    };
    const onWatchdog = () => {
      clearWatchdog();
      if (scopeIsLive() && !watchdogRestarted) {
        // Nothing ever ended: replay once from `from` on a fresh clock (the
        // resume's original-clock tracking is reset by fullRestart) and re-arm.
        watchdogRestarted = true;
        disarmPerceptualCut();
        scopeResume.fullRestart();
        armWatchdog();
        return;
      }
      // Restart already spent, or nothing to gate: resolve rather than strand
      // the task until the 1.2s gate.
      resolve();
    };

    const recovering = animHoldReleased;
    // The active screen's non-scope participants (riding bars, decorator,
    // parts) recover too, each on its OWN name/clock — pure resume, no task.
    const participantDetachers = recovering ? wireParticipantRecovery(scope, variantKey) : [];
    if (recovering) {
      scopeResume.attach();
      // Arm on the transition INTO released (this effect re-runs when the hold
      // releases; a hold-free variant attaches with animHoldReleased already
      // true and arms here immediately). Only with a task to resolve.
      if (flooredTaskId) armWatchdog();
    }
    // Native-clock stall re-anchor (see nativeStallAnchor): main-thread
    // presentation only — on Blink the compositor plays through main stalls,
    // where a shift would yank a smooth animation backwards. Each shift
    // pushes the wall-clock deadlines out of the way: the watchdog re-arms
    // on the stretched timeline and the perceptual cut (a wall-clock timer)
    // stands down exactly as it does for any recovery event.
    // Flight-start anchor (see nativeStallAnchor): the release commit's own
    // render pass is the one block the stall watcher has no baseline for —
    // the swallowed opening of the covered screen's parallax. Same non-Blink
    // gate, same deadline pushes as a stall shift.
    if (recovering && (nativeSurgeryAllowed || routedTouchGoverned)) {
      startHoldDisarms.set(scope, () => {
        disarmPerceptualCut();
        if (flooredTaskId && watchdog !== undefined) armWatchdog();
      });
    }
    // Flight-START anchor: armed for EVERY routed-native flight, not only
    // authored pins. Unlike the mid-flight surgeries (pause/play, stall
    // shifting) this is the one clock intervention the 2026-08 falsification
    // series never implicated: a one-shot, birth-window startTime rewind
    // leaves an animation indistinguishable from one that was simply born a
    // few frames later — no negative delay, no pause history, nothing for an
    // accelerated re-sync to trip on. It is the direct antidote to the
    // release-frame co-flush: when a reveal render stretches the release
    // frame, the compiled clock ages by the whole block before first paint
    // (device-video'd as the entering sheet's first presented frame already
    // at ~60% of travel); the anchor's rAF fires right after that block —
    // before, or at worst one frame after, the animation's first
    // presentation — and pulls the clock back to one step, so the opening
    // plays in full.
    // (Flight-start anchor: armed on the PRE-release run — see
    // detachReleaseAnchor above; the recovering-run arming inherited the
    // effect's race with the release block and was retired for it.)
    const detachStallWatch =
      // LPM stays OUT of the continuous watch: its rAF gaps (33-62ms under
      // load) are not presentation gaps — the compositor keeps presenting
      // at panel rate, which is the very reason LPM routes to compiled. Each
      // gap-excess shift there yanked a smoothly-presenting flight back
      // 5-29ms at 30Hz — device-measured micro-jerk texture. Same physics
      // as the Blink exclusion below, one tier down.
      //
      // The routed compiled tier (LPM and force-compiled) takes NO stall
      // watch. Device measurement retired it as a net negative there: the
      // watch is a gap-based clock rewind, and on touch WebKit an rAF gap is
      // NOT a presentation gap — the compositor keeps presenting at panel rate
      // through it — so the rewind yanks a smoothly-presenting flight
      // backwards and WebKit answers the running-clock write by cutting the
      // flight to its end. Worse, before LPM is DETECTED (the first flight of
      // a session) a force-compiled flight read !routedTouchGoverned as true
      // and armed the watch, so the very first push of every LPM session
      // jumped (probe: clock rewound 322→113 on flight 0 while flights 1+,
      // LPM-detected and watch-free, held a perfect maxdx=0). The reveal-block
      // opening is protected by the pre-raster (the content layer rasters
      // during the hold) and the governed head instead — never by surgery.
      recovering && nativeSurgeryAllowed
        ? watchNativeStalls(
            // A main-thread stall freezes the WHOLE PAGE's presentation, so
            // every running flemo timeline must shift together — the sibling
            // screen (each screen lives in its own wrapper, NOT beside this
            // scope), its decorator, riding bars, nested routers, all of it.
            // Shifting only this scope's participants resumed the active
            // side smoothly while the covered screen teleported the stalled
            // span on the next frame (measured on WebKit: a forced 120ms
            // stall left the covered screen's startTime unshifted and its
            // 30% parallax visibly snapped). The documentElement subtree is
            // the complete, structure-independent target; the per-frame
            // shift dedup keeps overlapping watchers single-shift.
            () => [scope.ownerDocument.documentElement],
            () => {
              disarmPerceptualCut();
              if (flooredTaskId && watchdog !== undefined) armWatchdog();
            }
          )
        : null;

    // Perceptual completion cut (see perceptualSpan.ts): once every animated
    // channel of BOTH sides has permanently entered its imperceptibility band
    // (< 1 device pixel / < one opacity step remaining), the rest of the
    // clock presents nothing — resolve there and skip the sub-pixel shimmer
    // window. Compiled-CSS path only (the player owns its own tail), armed at
    // the release (the same commit that unpauses the animation), and DISARMED
    // the moment recovery touches the clock (a cancel-resume or watchdog
    // restart shifts presentation later than the wall-clock cut). <Part>
    // choreography runs on its own registered timings, so every part
    // participating in this STATUS — both screens' (parts self-carry their
    // variant attributes) — contributes its own cut to the ceiling; a part
    // whose motion cannot be analyzed vetoes the cut entirely.
    let perceptualCut: ReturnType<typeof setTimeout> | undefined;
    const clearPerceptualCut = () => {
      if (perceptualCut === undefined) return;
      clearTimeout(perceptualCut);
      perceptualCut = undefined;
    };
    disarmPerceptualCut = clearPerceptualCut;

    // The softened curve invalidates the cut/rest profiles (perceptualCutMs
    // reads the authored motion) — a cut timed on the authored curve would
    // fire while the softened curve is still perceptibly moving. Under the
    // gate both wall-clock accelerators stand down; the clean end
    // (animationend) resolves.
    //
    // routedForceCompiled (touch WebKit on the compiled tier) stands them down
    // for a deeper reason, the SAME class that keeps LPM off them: these are
    // WALL-CLOCK timers that assume the compiled animation's PRESENTATION
    // tracks the wall clock. On touch WebKit the animation presents
    // out-of-process, and a main-thread block (a rapid chain's heavy commit)
    // lags that presentation behind the clock — so the cut fires while the
    // screen is still visibly mid-flight, resolves the flight, and the rest
    // rule snaps it to the end (device-reproduced as a rapid tab→detail
    // jump-to-completion). The clean animationend, which the compositor raises
    // only when the pixels actually finish, is the sole safe completion here.
    // (2026-08-13 landing-placement ledger, all three device-judged: the
    // parked-content flush is the mid-fade governor freeze, but moving it
    // to COMPLETED read WORSE (the end hitch interrupts the settle), and
    // the pre-release placement was the settle-gate deadlock era. The
    // early-landing placement stays — least-bad of three.)
    if (recovering && flooredTaskId && !governedSlide && !routedForceCompiled) {
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const activeCut = perceptualCutMs(activeMotion!, scope, dpr);
      // Both sides must be inside their bands before the COMPLETED flip cuts
      // them; an unanalyzable passive side vetoes. (Passive % distances
      // resolve against this scope's box — sibling screens share the
      // viewport.)
      const passiveCut = passiveMotion ? perceptualCutMs(passiveMotion, scope, dpr) : 0;
      // Part ceiling: percentage distances resolve against each part's own
      // box, exactly as its compiled keyframes do.
      let partsCut: number | null = 0;
      for (const { element: part, motion: partMotion } of statusPartMotions) {
        const partCut = perceptualCutMs(partMotion, part, dpr);
        if (partCut === null) {
          partsCut = null;
          break;
        }
        partsCut = Math.max(partsCut, partCut);
      }
      // Decorator ceiling: its % distances resolve against its own box; a
      // missing element (or unanalyzable motion) vetoes, like any participant.
      let decoratorCut: number | null = 0;
      if (statusDecoratorMotions.length > 0) {
        // No decorator ELEMENT means the decorator simply isn't participating
        // in this flight (nothing renders, nothing animates) — skip, don't
        // veto. An unanalyzable motion on a PRESENT decorator vetoes.
        const decoratorElement = getElements().decorator;
        if (decoratorElement) {
          for (const decoratorMotion of statusDecoratorMotions) {
            const oneCut = perceptualCutMs(decoratorMotion, decoratorElement, dpr);
            if (oneCut === null) {
              decoratorCut = null;
              break;
            }
            decoratorCut = Math.max(decoratorCut, oneCut);
          }
        }
      }
      // A ceiling at or past the choreography's natural span is pointless —
      // the clean-end path (animationend + the choreography-span deferral)
      // resolves there anyway.
      const cutMs =
        activeCut !== null && passiveCut !== null && partsCut !== null && decoratorCut !== null
          ? Math.max(activeCut, passiveCut, partsCut, decoratorCut)
          : null;
      if (cutMs !== null && cutMs + 17 < motionSpanMs + choreographyExtraMs) {
        perceptualCut = setTimeout(
          () => {
            perceptualCut = undefined;
            if (!scopeIsLive()) return;
            scope.removeEventListener("animationend", onEnd);
            clearWatchdog();
            stopScopeRecovery();
            // A cut is a CLEAN completion (both sides inside their bands) — the
            // flip commit still waits for the presented frame like any clean
            // end; the sub-pixel tail keeps playing under the compiled rules
            // during the deferral, so nothing snaps.
            resolvePresented();
            // The LPM stretch dilates the playing curve and the birth hold
            // shifts it — the wall-clock cut rides with both.
          },
          cutMs * governedStretch + 17 + governedBirthHoldMs
        );
      }
    }

    // Early landing of the in-flight arrival hold (the hold itself:
    // arrivalHold.ts). The release commit — parked skeletons removed, held
    // content revealed, frozen writes replayed — is the settle window's
    // single biggest main-thread item (measured on the consumer app: ~10ms of
    // layout plus a ~56-region paint storm landing two frames past the
    // COMPLETED flip, exactly the frames the eye watches settle). But the
    // hold's own contract only needs the screen to be VISUALLY at rest, not
    // administratively COMPLETED: once every participant of the choreography
    // is within one CSS pixel / one opacity step of its destination (the same
    // backward band scan as the perceptual cut, evaluated at
    // devicePixelRatio 1), a content change cannot read as motion-stutter —
    // and the compositor still owns frame production, so the commit's
    // layout/paint cost hides under the playing sub-pixel tail instead of
    // stacking onto the convergence. The perceptual cut's device-pixel band
    // is always at least as tight, so this fires at or before the cut; an
    // unanalyzable participant keeps the deferred post-COMPLETED landing.
    // The arrival hold lands AT REST — after the COMPLETED flip — on every
    // tier. It used to land EARLY on most of them: at the choreography's
    // visual rest point (every participant within one CSS pixel of its
    // destination), so the release commit's layout and paint would hide under
    // the compositor-owned sub-pixel tail instead of stacking onto the
    // convergence (#228, measured on the consumer app: ~10ms of layout plus a
    // ~56-region paint storm).
    //
    // The tail turned out to be exactly where that commit shows. On the
    // steady-60 desktop profile the live stream caught one skipped-frame-class
    // gap (max 21-29ms) on essentially EVERY push — the reported compiled-tier
    // "버벅임" — while pops, whose reveals are tiny, stayed at 17-20ms; LPM
    // softening and the force-compiled touch tier had already been excluded for
    // the same reason. That left desktop Blink and desktop Safari as the only
    // tiers still landing early, and nothing in the evidence made them
    // different: a shorter frame budget (120Hz) makes the same burst MORE
    // likely to show, not less.
    //
    // So the placement is uniform now, and the trade is stated once: the
    // content becomes visible ~150ms later, which is invisible next to a hitch
    // on the frames the eye watches settle.
    return () => {
      stopKeepalive();
      if (floor !== undefined) clearTimeout(floor);
      if (choreographyTimer !== undefined) clearTimeout(choreographyTimer);
      cancelLandingClear();
      detachFirstFrameHold?.();
      detachGovernedBirthAnchor?.();
      detachStallWatch?.();
      clearPerceptualCut();
      scope.removeEventListener("animationend", onEnd);
      if (recovering) {
        scopeResume.detach();
        for (const detach of participantDetachers) detach();
      }
      clearWatchdog();
      // Prune a stale budget entry: if this transition is no longer current the
      // task is done, so its entry is dead. A re-run while the task is STILL
      // current keeps it, so the per-task budget survives effect re-runs.
      if (flooredTaskId && deps.getTransitionTaskId() !== flooredTaskId) {
        activeResumeCounts.delete(flooredTaskId);
      }
    };
  };

  return {
    driveScreenLifecycle,
    // Internal, for the leak-regression test: how many in-flight tasks hold an
    // active-scope resume-budget entry. Not part of the binding contract.
    activeResumeEntryCount: () => activeResumeCounts.size
  };
}
