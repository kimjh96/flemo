import TaskManger from "@core/TaskManger";

import { clearInlineAnimation, trackInlineWrite } from "@transition/animateInline";
import { animationName, variantHasAnimation } from "@transition/compileTransitionStyles";
import resolveTransition from "@transition/resolveTransition";
import settleScrubber from "@transition/settleScrub";

import type { TransitionVariant } from "@transition/typing";
import { resolveVariantMotion, type VariantMotion } from "@transition/variantMotion";

import createArrivalHold from "@core/engine/arrivalHold";
import holdCompositorWarm from "@core/engine/compositorWarmUp";
import driverPolicy, { detectBlinkEngine } from "@core/engine/driverPolicy";
import { noticeDeviceEmulationOnce } from "@core/engine/emulationNotice";
import { beginFlightWindow } from "@core/engine/flightWindow";
import { stampAsyncImageDecode } from "@core/engine/imageDecodeHygiene";
import createInvisibleAnimationHold from "@core/engine/invisibleAnimationHold";
import {
  governedBezierForMotion,
  governedEasingForMotion,
  snappedEasingForMotion
} from "@core/engine/landingPixelSnap";
import { holdScopeLayer, releaseScopeLayerAfterSettle } from "@core/engine/layerSettleHold";
import {
  armLowPowerCadenceLifecycle,
  lowPowerCadenceActive,
  probeLowPowerCadence
} from "@core/engine/lowPowerCadence";

import { perceptualCutMs } from "@core/engine/perceptualSpan";
import { beginResponseHold } from "@core/engine/responseHold";
import transitionPlayers, {
  learnedFrameIntervalMs,
  reportDisplayIntervalMs
} from "@core/engine/transitionPlayer";
import {
  SKIP_ANIMATION_ATTR,
  type ScreenLifecycleInput,
  type TransitionEngine,
  type TransitionEngineDeps
} from "@core/engine/types";
import { decoratorMap } from "@transition/decorator/decorator";
import { partTransitionMap } from "@transition/partTransition/partTransition";

import { classifyTransitionDriver } from "./motionDriverKind";
import {
  armFlightStartAnchorAtRelease,
  holdNativeClocksToFirstFrame,
  watchNativeStalls
} from "./nativeStallAnchor";

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
// This module's layer-hold owner token. A swipe gesture (createSwipeController)
// OPT-IN landing-snap diagnostic flag, read defensively: a partitioned or
// sandboxed document throws on sessionStorage access, and a measurement
// toggle must never propagate that into driveScreenLifecycle.
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

const readLandingSnapFlag = (): boolean => {
  try {
    return (
      typeof sessionStorage !== "undefined" && sessionStorage.getItem("flemo:landing-snap") === "on"
    );
  } catch {
    return false;
  }
};

// High-refresh routing (see joinPlayer): below this display interval the
// compiled tier drives on Blink. 12ms sits between 120Hz (8.3) and 90Hz
// (11.1) on one side and 60Hz (16.7) on the other — and a power-throttled
// presentation (30Hz measured on battery) never qualifies, so the player's
// even-cadence handling keeps owning those states.
const COMPILED_TIER_MAX_INTERVAL_MS = 12;

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
const armDisplayIntervalProbe = () => {
  if (displayProbeActive || typeof requestAnimationFrame !== "function") return;
  displayProbeActive = true;
  const gaps: number[] = [];
  let lastTick: number | null = null;
  const tick = (time: number) => {
    if (lastTick !== null) gaps.push(time - lastTick);
    lastTick = time;
    if (gaps.length < 6) {
      requestAnimationFrame(tick);
      return;
    }
    displayProbeActive = false;
    const sorted = [...gaps].sort((a, b) => a - b);
    reportDisplayIntervalMs(sorted[Math.floor(sorted.length / 2)]!);
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
  // Landing pixel snap (see landingPixelSnap.ts): reshape each translating
  // participant's compiled easing so the flight presents integer device
  // pixels — stamped as an INLINE longhand (clearInlineAnimation strips it
  // at COMPLETED with animation-delay); a riding bar shares the screen's
  // string so the pair stays in lockstep. OPT-IN diagnostics only
  // (`sessionStorage.setItem("flemo:landing-snap", "on")` + reload): a live
  // A/B on real content judged texel-rigid stepping WORSE than the authored
  // fractional glide — the same verdict as the transformPart 2D-vs-3D
  // experiment (translate3d chosen precisely for filtered sub-pixel
  // compositing). The machinery stays for measurement work.
  // The storage read is wrapped like every other diagnostic toggle (see
  // transitionPlayer's overrides): a sandboxed/partitioned context can throw
  // SecurityError on sessionStorage access, and an OPT-IN measurement flag
  // must never take the whole transition down with it.
  const snapEasing = detectBlinkEngine() && readLandingSnapFlag();
  // The landing governor for the COMPILED tier (see governedEasingForMotion):
  // when Blink routes to the compiled path (desktop always, touch devices at
  // a genuine high-refresh cadence — the same predicate as joinPlayer's
  // decline rule), the authored curve's sub-pixel tail parks the sheet short
  // of its landing and the COMPLETED flip closes the gap late — the reshaped
  // easing sprints the tail at one device pixel per frame instead. Inert
  // under the player (it suppresses the compiled animation).
  const governEasing =
    !snapEasing &&
    detectBlinkEngine() &&
    ((typeof navigator !== "undefined" && navigator.maxTouchPoints === 0) ||
      learnedFrameIntervalMs() < COMPILED_TIER_MAX_INTERVAL_MS);
  // The governor for ACCELERATED WebKit (the routed touch compiled tier):
  // Core Animation timing is bezier-only, so the governed curve lands as a
  // least-error cubic-bezier FIT over a shortened duration (see
  // governedBezierForMotion) — the player's firm early landing, in the one
  // form the accelerated path carries. Inert under the player (which
  // suppresses the compiled animation), so REPLACING/chained flights are
  // unaffected even though the stamp is unconditional on touch WebKit.
  // Retired with the touch-compiled routing (see the joinPlayer ledger):
  // the bezier-fit governor matched the compiled tail to the player's and
  // the texture verdict still closed the tier. The fitter stays in
  // landingPixelSnap as a measured instrument; nothing stamps it.
  const governBezier = false;
  const dpr =
    (snapEasing || governEasing || governBezier) && typeof window !== "undefined"
      ? window.devicePixelRatio || 1
      : 1;
  const easingFor = (motionSource: VariantMotion | null, box: HTMLElement): string | null => {
    if (!motionSource) return null;
    if (snapEasing) return snappedEasingForMotion(motionSource, box, dpr);
    if (governEasing) {
      return governedEasingForMotion(motionSource, box, dpr, learnedFrameIntervalMs());
    }
    return null;
  };
  const applyGovernedBezier = (motionSource: VariantMotion | null, box: HTMLElement) => {
    if (!governBezier) return;
    const fit = governedBezierForMotion(motionSource, box, dpr, learnedFrameIntervalMs());
    if (!fit) return;
    trackInlineWrite(box, "animation-timing-function", owner);
    box.style.animationTimingFunction = fit.easing;
    trackInlineWrite(box, "animation-duration", owner);
    box.style.animationDuration = `${fit.durationMs}ms`;
  };
  if (variantHasAnimation(transition, variant)) {
    holdScopeLayer(scope, transition, containment, owner);
    const scopeMotion = resolveVariantMotion(transition, variant) ?? null;
    const easing = easingFor(scopeMotion, scope);
    if (easing) {
      trackInlineWrite(scope, "animation-timing-function", owner);
      scope.style.animationTimingFunction = easing;
    } else {
      applyGovernedBezier(scopeMotion, scope);
    }
    for (const bar of bars ?? []) {
      if (bar?.getAttribute("data-flemo-bar-riding") === "true") {
        holdScopeLayer(bar, transition, containment, owner);
        if (easing) {
          trackInlineWrite(bar, "animation-timing-function", owner);
          bar.style.animationTimingFunction = easing;
        } else {
          applyGovernedBezier(scopeMotion, bar);
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
      if (!partEasing) applyGovernedBezier(partMotion, part);
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
    if (event.target !== element || event.animationName !== expectedName) return;
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
  // Low Power Mode cadence sampling (see lowPowerCadence.ts): boot probe +
  // visibility-return re-probe, deduped module-wide; non-Blink touch only.
  armLowPowerCadenceLifecycle();
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
    if (holdsArrivals && !releaseArrivalHold) {
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
        // drives, or its WAAPI outranks the compiled animation for its span.
        settleScrubber.takeover(scope);
        const releaseHold = createArrivalHold(scope);
        const releaseAnimations = createInvisibleAnimationHold(scope);
        const holdSpanMs = statusChoreographySpanMs(
          scope,
          resolveTransition(transitionName),
          status
        );
        const releaseResponses = beginResponseHold(holdSpanMs + GATE_MOTION_MARGIN_MS);
        // The global flight-window latch (see flightWindow.ts): insertion-time
        // machinery outside this drive (the image decode offloader) defers
        // opaque-original reveals to the same rest this release lands.
        const releaseFlightWindow = beginFlightWindow();
        releaseArrivalHold = () => {
          releaseResponses();
          releaseAnimations();
          releaseHold();
          releaseFlightWindow();
        };
      }
    }

    // Join this screen's participants (scope, riding bars, decorator) to the
    // navigation's shared player. The player covers every motion — numeric
    // interpolation or a scrubbed Web Animation — so a null here means the
    // player must not or cannot run (replay chain, demoted device, no WAAPI)
    // and the compiled CSS path stays in charge.
    const joinPlayer = (
      variant: TransitionVariant,
      role: "active" | "passive",
      onComplete?: () => void
    ): (() => void) | null => {
      const taskId = deps.getTransitionTaskId();
      if (!taskId) return null;

      // Per-context driver selection, both decided by the library:
      // 1. A REPLAY CHAIN (more navigations queued behind this one — a rapid
      //    back/forward storm) runs on the compiled CSS path on BLINK ONLY:
      //    there the queued screens' mount commits land mid-flight, which
      //    stalls a main-thread player while the compositor glides. On
      //    non-Blink the compiled tier is the WRONG refuge — its clock is
      //    stamped a whole pipeline (style/layer work + CA commit + UI-
      //    process activation) before first glass, so a chained flight born
      //    into a heavy commit is swallowed wholesale. Device-video'd
      //    (iPhone, 2026-08): a chained POP (returning screen's unfreeze =
      //    the monster commit) presented as a ONE-FRAME swap, the user
      //    naturally re-tapped into the still-pending queue, and every
      //    alternate push then chained onto CSS and jumped — while the
      //    unchained flights around them played the player perfectly. The
      //    player's capped clock is precisely the driver that survives
      //    mid-flight commits there: chains ride it too.
      if (detectBlinkEngine() && TaskManger.pendingTaskIds.some((id) => id !== taskId)) {
        return null;
      }
      // 2. HIGH-REFRESH Blink runs the COMPILED tier: at a ~120Hz cadence the
      //    player's per-frame main-thread write must survive commit →
      //    activation → draw inside an 8.3ms budget, and traced on a
      //    ProMotion MacBook it measurably cannot — 36% of the flight's
      //    frames presented PARTIAL (the vsync shipped without the player's
      //    latest position; PipelineReporter: 81/224 vs 6/149 compiled, same
      //    machine, same flight), an every-few-frames stale-then-double-step
      //    the eye reads as trembling and rAF timing cannot see. The
      //    compiled animation is compositor-driven and immune. Blink-only:
      //    WebKit presents from the main thread, so its player writes ARE
      //    the presentation.
      //    DESKTOP Blink routes unconditionally, not by measured cadence: an
      //    adaptive panel (ProMotion) idles at 60Hz, so the load-time probe
      //    reads 16.7ms on the very machine that ramps to 120Hz the moment a
      //    compositor animation runs — the interval gate flipped per-session
      //    on the same hardware (measured: real Chrome, idle rAF 16.7ms
      //    median on the 120Hz panel). Touch devices keep the
      //    device-verified player; for them the learned interval, refreshed
      //    by the engine's own probe (armed below), still routes genuine
      //    high-refresh cadences.
      if (
        detectBlinkEngine() &&
        ((typeof navigator !== "undefined" && navigator.maxTouchPoints === 0) ||
          learnedFrameIntervalMs() < COMPILED_TIER_MAX_INTERVAL_MS)
      ) {
        armDisplayIntervalProbe();
        return null;
      }
      // 3. DESKTOP WebKit runs the COMPILED tier: macOS Safari caps rAF at
      //    60Hz (measured 17ms median on a 120Hz ProMotion panel), so the
      //    player can only ever paint half the display's frames there —
      //    eye-verified as a trembling tracked glyph, a coarse late landing,
      //    and pop judder, all of which the css-pinned session cleared at
      //    once. CSS/WAAPI animations are compositor-driven and run at the
      //    panel's full rate. Touch devices (real iPhones/iPads — including
      //    iPads spoofing a Mac platform, which report maxTouchPoints > 0)
      //    keep the device-verified player for CHAINED flights; jsdom
      //    reports an empty platform and stays on the player for the unit
      //    suites.
      if (
        !detectBlinkEngine() &&
        typeof navigator !== "undefined" &&
        navigator.maxTouchPoints === 0 &&
        /Mac/.test(navigator.platform ?? "")
      ) {
        return null;
      }
      // TOUCH WebKit keeps the device-verified player, wholesale — the
      //    FINAL verdict, now three times over. The 2026-08 campaign's
      //    complete ledger: the player costs presentation quantization on
      //    slow tracked motion plus commit misses under bursts; the routed
      //    compiled tier is smooth but swallows its opening whenever the
      //    entry commit ages the wall clock (probe: 133-282dpx first steps,
      //    3 flights in 4), and EVERY form of clock surgery that would fix
      //    it — one-shot rewind (loses the race), effect-armed two-phase
      //    hold (same race), release-microtask arming with pending-clock
      //    startTime pins (WebKit cut whole flights to their end ~100ms in,
      //    trajectory-measured) — lands in the falsified class the
      //    nativeSurgeryAllowed comment already recorded: on WebKit, timing
      //    surgery on a running/pending animation is not reliable. The one
      //    flight whose anchor won its race matched the player exactly, so
      //    the OPENING, not texture, is the compiled tier's real blocker —
      //    and the only unfalsified route to it is making the release
      //    commit itself cheap (release scheduling), a design campaign of
      //    its own. Until then: player.
      // 4. LOW-POWER-MODE touch WebKit runs single SLIDES on the COMPILED
      //    tier (see lowPowerCadence.ts — isolated detection, never the
      //    player's learned interval). Native parity: LPM caps rAF at ~30Hz
      //    while the compositor presents at panel rate, so the player is
      //    structurally half-density there. Routed flights arm the birth
      //    anchor + stall watcher (see routedLpmSupervision) — trajectory-
      //    verified: bare routing opened pushes 360-550 device px deep
      //    after a 68-95ms release gap; the protected stack's flights
      //    opened on the authored ramp, and the user eye-verified the LPM
      //    round on device. REPLACING keeps the player (compiled REPLACING
      //    presents the exiting screen over the new tab for a beat) and
      //    chains keep the one-frame-swap protection.
      if (
        !detectBlinkEngine() &&
        typeof navigator !== "undefined" &&
        navigator.maxTouchPoints > 0 &&
        lowPowerCadenceActive() &&
        (status === "PUSHING" || status === "POPPING") &&
        !TaskManger.pendingTaskIds.some((id) => id !== taskId)
      ) {
        probeLowPowerCadence(); // keep the flag fresh per routed flight
        return null;
      }
      // 4. A device whose main thread chronically starves the player even on
      //    single navigations (measured by the player's own frame gaps)
      //    earned a demotion; CSS drives everything there, as it always did.
      if (!driverPolicy.playerAllowed()) return null;

      const { scope, decorator, bars } = getElements();
      if (!scope) return null;

      const transition = resolveTransition(transitionName);
      // 3. KIND-scoped choice (see motionDriverKind): a transition whose
      //    authored screens demonstrably MOVE fast renders cleanest on the
      //    native clock — measured on WebKit, the player's rAF jitter reads
      //    as a fine tremor on fast movers while fades need the player's
      //    re-anchoring through heavy ungated mounts. Every participant of a
      //    navigation calls through here with the same transition and status,
      //    so the whole navigation lands on ONE driver. A "raf" force pin
      //    bypasses this — a pinned session must player-drive everything to
      //    be a useful instrument.
      if (driverPolicy.pinnedDriver() !== "raf") {
        const status = variant.split("-")[0]!;
        if (classifyTransitionDriver(transition, status, scope) === "native") return null;
      }
      const motion = resolveVariantMotion(transition, variant);
      if (!motion) return null;

      const detachers: (() => void)[] = [];
      const scopeDetach = transitionPlayers.join(taskId, {
        element: scope,
        motion,
        role,
        onComplete
      });
      if (!scopeDetach) return null;
      detachers.push(scopeDetach);

      // A riding shared bar mirrors the screen's own motion (the compiled CSS
      // did the same by pairing the bar selector with the screen keyframes).
      for (const bar of bars ?? []) {
        if (!bar || bar.getAttribute("data-flemo-bar-riding") !== "true") continue;
        const barDetach = transitionPlayers.join(taskId, {
          element: bar,
          motion,
          role: "passive"
        });
        if (barDetach) detachers.push(barDetach);
      }

      if (decorator && transition.decoratorName) {
        const decoratorDefinition = decoratorMap.get(transition.decoratorName);
        const decoratorMotion = decoratorDefinition
          ? resolveVariantMotion(decoratorDefinition, variant)
          : null;
        if (decoratorMotion) {
          const decoratorDetach = transitionPlayers.join(taskId, {
            element: decorator,
            motion: decoratorMotion,
            role: "passive"
          });
          if (decoratorDetach) detachers.push(decoratorDetach);
        }
      }

      // <Part> elements join too, each with its OWN registered motion, so the
      // whole navigation — screen, dim, bars, and every part — steps off one
      // clock. Parts mirror their screen's status/active onto themselves, so
      // selecting by this join's variant scopes the query to THIS screen's
      // parts (a nested screen's parts carry a different status). Parts that
      // mount mid-transition miss the join and keep their compiled CSS
      // animation — correct motion, just not clock-unified.
      for (const part of collectVariantParts(scope, variant)) {
        const definition = partTransitionMap.get(part.getAttribute(PART_NAME_ATTR)!);
        const partMotion = definition ? resolveVariantMotion(definition, variant) : null;
        if (!partMotion) continue;
        const partDetach = transitionPlayers.join(taskId, {
          element: part,
          motion: partMotion,
          role: "passive"
        });
        if (partDetach) detachers.push(partDetach);
      }

      return () => detachers.forEach((detach) => detach());
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
      // screen on pop) joins the shared player at hold release so both layers
      // step off the same clock. Before release — and for variants the player
      // can't drive — the compiled CSS (hold/park rules included) stays in
      // charge, exactly as before.
      if (isTransitional && animHoldReleased) {
        const variant = `${status}-false` as TransitionVariant;
        const detach = joinPlayer(variant, "passive");
        if (detach) return detach;

        // Player declined (replay chain, demoted device, or a variant it can't
        // interpolate): the compiled CSS drives this exit. Wire cancel-resume on
        // every participant so a WebKit-cancelled fade rejoins its timeline
        // instead of dying silently under the incoming top. Pure resume — the
        // passive side has no task to resolve; when a budget or the element's
        // life is exhausted it just stops.
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
      deps.setDragStatus("IDLE");
      deps.setReplaceTransitionStatus("IDLE");
      // Strip inline styles a swipe, the rAF player, or an interleaved
      // navigation may have left on this screen and its related elements, so
      // the next push/pop runs against the compiled CSS rest rule on a clean
      // slate.
      const { scope, decorator, bars } = getElements();
      if (scope) {
        clearInlineAnimation(scope);
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

    // The task this transition gates, captured HERE (never the live one — a
    // late resolver must not cut a NEWER transition). Shared by the resolver,
    // the liveness floor, the recovery watchdog, and the active-scope resume
    // budget.
    const flooredTaskId = deps.getTransitionTaskId();

    const resolve = () => {
      const transitionTaskId = deps.getTransitionTaskId();
      if (transitionTaskId) {
        void TaskManger.resolveTask(transitionTaskId);
      }
      // The task is settling — drop its resume-budget entry so the map only
      // ever holds the handful of genuinely in-flight tasks.
      if (flooredTaskId) activeResumeCounts.delete(flooredTaskId);
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
    const playerCanDrive = !skipAnimation && !!activeMotion;

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
    // LPM-routed flights supervise with plain startTime rewinds only (the
    // R30-verified birth anchor + the stall watcher). The pause/play
    // first-frame hold stays authored-native-only (falsified: it costs
    // WebKit's accelerated representation), and the two-phase hold with
    // pending-clock pins is on the do-not-reattempt list.
    const routedLpmSupervision =
      !detectBlinkEngine() &&
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 0 &&
      lowPowerCadenceActive();
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
    // LPM-routed birth anchor, armed at the PRE-release run so its observer
    // catches the anim-hold release in the microtask ahead of the release
    // block's rendering update. ONE-SHOT rewind form only
    // (holdFirstFrame=false): the R30-verified clock intervention. The
    // refcounted registry inside carries the armed observer across the
    // effect re-run at release.
    let detachLpmBirthAnchor: (() => void) | null = null;
    if (playerCanDrive && routedLpmSupervision && !nativeSurgeryAllowed) {
      detachLpmBirthAnchor = armFlightStartAnchorAtRelease(
        scope,
        () => [scope.ownerDocument.documentElement],
        () => startHoldDisarms.get(scope)?.(),
        false
      );
    }
    let detachFirstFrameHold: (() => void) | null = null;
    if (playerCanDrive && nativeSurgeryAllowed) {
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
    // Disarms the arrival hold's early landing (wired below) on the same
    // events, for the same reason: a shifted presentation means the wall-clock
    // rest point may still be visibly mid-motion.
    let disarmEarlyLanding = noop;
    const onEnd = (event: AnimationEvent) => {
      if (event.target !== scope) return;
      if (event.animationName !== expectedName) return;
      scope.removeEventListener("animationend", onEnd);
      clearWatchdog();
      stopScopeRecovery();
      resolveAfterChoreography();
    };
    scope.addEventListener("animationend", onEnd);

    // Additive rAF driving: only once the hold has released (the compiled
    // hold/park rules own the pre-release frames). A chain-gated or
    // non-joinable variant simply keeps the compiled animation + `onEnd`.
    const detachPlayer =
      playerCanDrive && animHoldReleased
        ? // The player's onComplete is a clean end too: its final frame was
          // just written, so the flip commit waits for it to present exactly
          // like the compiled path (WebKit presents these frames from the main
          // thread, where the flip commit competes hardest).
          // The player fires this when EVERY track (screens, bars, dim,
          // parts) finishes on ITS OWN capped clock — a stall re-anchors all
          // of them together, so no wall-clock extra can cut a longer
          // participant early. The choreography deferral below remains for
          // the COMPILED path only.
          joinPlayer(variantKey, "active", resolvePresented)
        : null;

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
    const restartWatchdogMs = motionSpanMs + 250;

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
        disarmEarlyLanding();
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
        disarmEarlyLanding();
        scopeResume.fullRestart();
        armWatchdog();
        return;
      }
      // Restart already spent, or nothing to gate: resolve rather than strand
      // the task until the 1.2s gate.
      resolve();
    };

    const recovering = !detachPlayer && animHoldReleased;
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
    if (recovering && (nativeSurgeryAllowed || routedLpmSupervision)) {
      startHoldDisarms.set(scope, () => {
        disarmPerceptualCut();
        disarmEarlyLanding();
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
      recovering && (nativeSurgeryAllowed || routedLpmSupervision)
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
              disarmEarlyLanding();
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

    if (recovering && flooredTaskId) {
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
        perceptualCut = setTimeout(() => {
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
        }, cutMs + 17);
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
    let earlyLanding: ReturnType<typeof setTimeout> | undefined;
    const clearEarlyLanding = () => {
      if (earlyLanding === undefined) return;
      clearTimeout(earlyLanding);
      earlyLanding = undefined;
    };
    disarmEarlyLanding = clearEarlyLanding;
    if (recovering && releaseArrivalHold) {
      const activeRest = perceptualCutMs(activeMotion!, scope, 1);
      const passiveRest = passiveMotion ? perceptualCutMs(passiveMotion, scope, 1) : 0;
      let partsRest: number | null = 0;
      for (const { element: part, motion: partMotion } of statusPartMotions) {
        const partRest = perceptualCutMs(partMotion, part, 1);
        if (partRest === null) {
          partsRest = null;
          break;
        }
        partsRest = Math.max(partsRest, partRest);
      }
      let decoratorRest: number | null = 0;
      if (statusDecoratorMotions.length > 0) {
        const decoratorElement = getElements().decorator;
        if (decoratorElement) {
          for (const decoratorMotion of statusDecoratorMotions) {
            const oneRest = perceptualCutMs(decoratorMotion, decoratorElement, 1);
            if (oneRest === null) {
              decoratorRest = null;
              break;
            }
            decoratorRest = Math.max(decoratorRest, oneRest);
          }
        }
      }
      const restMs =
        activeRest !== null && passiveRest !== null && partsRest !== null && decoratorRest !== null
          ? Math.max(activeRest, passiveRest, partsRest, decoratorRest)
          : null;
      if (restMs !== null) {
        earlyLanding = setTimeout(() => {
          earlyLanding = undefined;
          const release = releaseArrivalHold;
          if (!release) return;
          releaseArrivalHold = null;
          release();
        }, restMs);
      }
    }

    return () => {
      if (floor !== undefined) clearTimeout(floor);
      if (choreographyTimer !== undefined) clearTimeout(choreographyTimer);
      cancelLandingClear();
      detachFirstFrameHold?.();
      detachLpmBirthAnchor?.();
      detachStallWatch?.();
      clearPerceptualCut();
      clearEarlyLanding();
      scope.removeEventListener("animationend", onEnd);
      if (recovering) {
        scopeResume.detach();
        for (const detach of participantDetachers) detach();
      }
      clearWatchdog();
      detachPlayer?.();
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
