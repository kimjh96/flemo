import TaskManger from "@core/TaskManger";

import { clearInlineAnimation } from "@transition/animateInline";
import {
  matchesFlightAnimationName,
  animationName,
  decoratorAnimationName,
  variantHasAnimation
} from "@transition/compileTransitionStyles";
import resolveTransition from "@transition/resolveTransition";

import type { TransitionVariant } from "@transition/typing";
import { resolveVariantMotion, type VariantMotion } from "@transition/variantMotion";

import { stageBarParts, type StagedBarParts } from "@core/engine/barPartStaging";
import { wireCancelResume } from "@core/engine/cancelResume";
import { createFlightHolds } from "@core/engine/flightHolds";
import {
  collectFlightParts,
  collectScreenParts,
  collectStampedOuterParts,
  collectUnheldOuterParts,
  collectVariantParts,
  statusChoreographySpanMs
} from "@core/engine/flightParticipants";
import { resolveFlightRouting } from "@core/engine/flightRouting";
import { stampAsyncImageDecode } from "@core/engine/imageDecodeHygiene";

import { collectLayerRiders, isRider } from "@core/engine/layerRiders";
import {
  armFlightStartAnchorAtRelease,
  holdNativeClocksToFirstFrame,
  watchNativeStalls
} from "@core/engine/nativeStallAnchor";
import { holdParticipantLayers, releaseParticipantLayers } from "@core/engine/participantLayers";
import { perceptualCutMs } from "@core/engine/perceptualSpan";
// The engine no longer consults the steady-60 verdict at all: the landing
// placement is uniform and the image hold is opt-in. It still FEEDS it — the
// display probe below reports the in-flight cadence the settle-gate default
// reads.
import {
  SKIP_ANIMATION_ATTR,
  type ScreenLifecycleInput,
  type TransitionEngine,
  type TransitionEngineDeps
} from "@core/engine/types";
import {
  ACTIVE_ATTR,
  ANIM_HOLD_ATTR,
  CREEP_ATTR,
  DESK_HEAD_ATTR,
  GOVERNED_ATTR,
  MORPH_CAMERA_ATTR,
  PART_NAME_ATTR
} from "@dom/attributes";
import {
  armDisplayIntervalProbe,
  armFramePacingKeepalive,
  cancelDisplayIntervalProbe,
  resetDisplayProbeForTests
} from "@platform/displayProbe";
import { detectBlinkEngine } from "@platform/engineProbes";
import { decoratorMap } from "@transition/decorator/decorator";
import { resolveDecoratorClock } from "@transition/decorator/resolveDecoratorClock";
import { resolvePartDefinition } from "@transition/partTransition/partTransition";

const noop = () => {};

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

// The first-frame clock hold resolves on its own rAF, potentially after the
// release run has armed its wall-clock deadlines — this slot lets the hold
// push THAT run's deadlines the same way a stall shift would (the closures
// are per-effect-run, the hold is per-flight).
const startHoldDisarms = new WeakMap<HTMLElement, () => void>();

// High-refresh threshold for the compiled tier's landing governor (see

// Framework-neutral transition engine. Created once per router scope with a
// minimal set of injected store callbacks; the binding (React, etc.) feeds it
// plain DOM elements and the current transition state. The engine owns the
// hard, reusable part: HOW the motion is driven, when the navigation task
// resolves and what gets cleaned up. Declarative output (data-attributes,
// initial/content styles) stays in the binding's render.
//
// Motion is driven by the COMPILED animation, everywhere — the rAF player that
// once shared this job was retired in 2026-08. What varies per flight is how
// its OPENING is protected (see flightRouting.ts) and how its participants are
// found, held and released (flightParticipants.ts, participantLayers.ts,
// cancelResume.ts). This file is what is left once those are named: the
// navigation-task lifecycle, the holds, and the resolution.
export { resetDisplayProbeForTests };

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
  // Every hold this screen owns across drive runs — the compositor warm-up,
  // the in-flight arrival armor, the warm side's image hold and the settle
  // timer. See flightHolds.ts; the two callbacks below are this engine's.
  const holds = createFlightHolds({
    landNow: () => landNow(),
    scheduleLanding: (land) => scheduleLanding(land)
  });

  // The in-flight commit hold for this screen's CURRENT transition (see
  // arrivalHold.ts). Engine-level, not per drive-run: the driver effect
  // re-runs mid-transition (the anim-hold release), and the hold must span
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

  // This screen's matched shared-bar parts while they are up in the Router's
  // part layer (see barPartStaging.ts). Held across drive calls because the
  // staging spans a whole flight: it is armed on the first transitional drive
  // and returned on the COMPLETED one, with several hold-flip drives between.
  let stagedBarParts: StagedBarParts | null = null;

  const driveScreenLifecycle = (input: ScreenLifecycleInput): (() => void) => {
    const { getElements, transitionName, prevTransitionName, status, isActive, animHoldReleased } =
      input;

    const isTransitional = status === "PUSHING" || status === "POPPING" || status === "REPLACING";

    // Bring staged bar parts home the moment this screen leaves the flight,
    // WHICHEVER side it is by then. Not in the passive COMPLETED branch, where
    // this used to live: a pop's passive screen is the returning one, so it is
    // ACTIVE by the time the flight completes and never reached that branch at
    // all. Its parts sat in the layer until the stranded backstop fired
    // seconds later, and the bar they left kept the hole where they had been —
    // observed as the title sitting shifted for the rest of the landing.
    if (!isTransitional && stagedBarParts) {
      stagedBarParts.release();
      stagedBarParts = null;
    }

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
      const { scope: early, bars: earlyBars, screenContainer: earlyContainer } = getElements();
      const earlyRiders = [...(earlyBars ?? []), ...collectLayerRiders(earlyContainer ?? null)];
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
        for (const bar of earlyRiders) {
          if (bar)
            clearInlineAnimation(
              bar,
              ["animation-timing-function", "animation-duration"],
              layerOwner
            );
        }
      }
    }

    holds.sync({
      isTransitional,
      isActive,
      status,
      transitionName,
      getScope: () => getElements().scope
    });

    // The display-interval probe. Its samples feed two live consumers — the
    // compiled tier's landing governor (learnedFrameIntervalMs, see
    // landingGovernor.ts) and the steady-60 desktop profile
    // (reportInFlightCadence -> the settle-gate default) — and both need a
    // reading taken IN FLIGHT, while the
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
      const { decorator, bars, screenContainer } = getElements();
      const riders = [...(bars ?? []), ...collectLayerRiders(screenContainer ?? null)];
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
        for (const bar of riders) {
          if (!isRider(bar)) continue;
          wirePure(bar, screenName, screenMotion);
        }
      }

      if (decorator && transition.decoratorName) {
        const decoratorDefinition = decoratorMap.get(transition.decoratorName);
        // The decorator's clock comes from this transition, so the motion the
        // cancel/resume controller reproduces has to be read the same way the
        // compiler wrote it.
        const decoratorMotion = decoratorDefinition
          ? resolveVariantMotion(resolveDecoratorClock(transition, decoratorDefinition), variant)
          : null;
        if (decoratorMotion) {
          wirePure(
            decorator,
            decoratorAnimationName(transition.name, transition.decoratorName, variant),
            decoratorMotion
          );
        }
      }

      for (const part of collectVariantParts(scopeEl, variant)) {
        const partName = part.getAttribute(PART_NAME_ATTR)!;
        const definition = resolvePartDefinition(partName, resolveTransition(transitionName));
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
        const { scope, decorator, bars, screenContainer } = getElements();
        const riders = [...(bars ?? []), ...collectLayerRiders(screenContainer ?? null)];
        if (scope) {
          clearInlineAnimation(scope);
          for (const part of collectScreenParts(scope)) clearInlineAnimation(part);
        }
        if (decorator) clearInlineAnimation(decorator);
        for (const bar of riders) {
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
        releaseParticipantLayers({ scope, decorator, bars: riders }, layerOwner);
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
        const { scope, decorator, bars, screenContainer, partLayer } = getElements();
        const riders = [...(bars ?? []), ...collectLayerRiders(screenContainer ?? null)];
        if (scope) {
          const transition = resolveTransition(transitionName);
          holdParticipantLayers(
            { scope, decorator, bars: riders },
            transition,
            `${status}-false` as TransitionVariant,
            layerOwner
          );
          // THE COVERED SIDE'S BAR PARTS COME UP OUT OF THE SCREEN.
          //
          // This is the passive screen, and passive means covered: the other
          // screen's container is an isolated stacking context at a higher
          // z-index with an opaque surface, so this screen's shared-bar parts
          // animate where nobody can see them. When the two screens share a bar
          // id the bar is non-riding and the parts are supposed to cross-fade
          // with their partners — so for the flight they are staged above both
          // screens instead. Armed from the FIRST transitional drive, beside
          // the layer pin, so the lift happens while the hold still has every
          // animation paused at its from-pose.
          stagedBarParts ??= stageBarParts({
            scope,
            bars: bars ?? [],
            layer: partLayer ?? null,
            // The backstop outlives the whole choreography, not just this
            // screen's own variant: a part authored longer than its screen is
            // exactly what statusChoreographySpanMs exists to measure, and the
            // slack matches the liveness floor's.
            strandedMs: statusChoreographySpanMs(scope, transition, status) + 1500
          });
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
            // variantHasAnimation SUBSUMES resolveVariantMotion's gate (a
            // non-rest variant with duration or delay > 0 — see
            // variantMotion.ts — plus something that actually interpolates),
            // so the assertion can never fire.
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
      const { scope, decorator, bars, screenContainer } = getElements();
      const riders = [...(bars ?? []), ...collectLayerRiders(screenContainer ?? null)];
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
        for (const part of collectScreenParts(scope)) {
          clearInlineAnimation(part);
          // A swipe marks its riders so the landing does not replay them from
          // their start (riderSwipe). The rider clears its own mark when its
          // animation finishes; this is for the one torn down before it could —
          // a mark left behind would suppress the NEXT flight's part animation
          // on an element that outlives this navigation.
          part.removeAttribute(SKIP_ANIMATION_ATTR);
        }
      }
      if (decorator) {
        clearInlineAnimation(decorator);
        decorator.removeAttribute(SKIP_ANIMATION_ATTR);
      }
      for (const bar of riders) {
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
      releaseParticipantLayers({ scope, decorator, bars: riders }, layerOwner);
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
      const { decorator, bars, screenContainer } = getElements();
      const riders = [...(bars ?? []), ...collectLayerRiders(screenContainer ?? null)];
      holdParticipantLayers(
        { scope, decorator, bars: riders },
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
      const definition = resolvePartDefinition(
        part.getAttribute(PART_NAME_ATTR),
        currentTransition
      );
      const partVariant = `${status}-${part.getAttribute(ACTIVE_ATTR)}` as TransitionVariant;
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
        // On this transition's clock (resolveDecoratorClock), which is what
        // makes the span it contributes below the SCREEN's span unless the
        // decorator's author asked for a longer one outright.
        const decoratorClock = resolveDecoratorClock(currentTransition, decoratorDefinition);
        for (const decoratorVariant of [
          `${status}-true`,
          `${status}-false`
        ] as TransitionVariant[]) {
          if (!variantHasAnimation(decoratorClock, decoratorVariant)) continue;
          const motion = resolveVariantMotion(decoratorClock, decoratorVariant);
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
        // A MORPH CAMERA carrying this screen IS the visible transition, even
        // though the screen's own transition animates nothing (a `zoom` morph
        // pairs with a still screen on purpose — the camera does the motion).
        // The camera runs on the screen element but is not a `participant` the
        // engine counts, so without this the task resolves on the still screen's
        // (absent) clock and flips COMPLETED ~200ms before the camera lands —
        // two convergence present spikes on WebKit, worse on a pop where the
        // returning screen is the one being zoomed. Span the camera too: read
        // its animation off the scope so no morph coupling is needed.
        const { scope: cameraScope } = getElements();
        let cameraSpanMs = 0;
        const cameraEl =
          cameraScope?.ownerDocument?.querySelector<HTMLElement>(`[${MORPH_CAMERA_ATTR}]`) ?? null;
        if (cameraEl && typeof cameraEl.getAnimations === "function") {
          for (const anim of cameraEl.getAnimations()) {
            const name = (anim as { animationName?: string }).animationName ?? "";
            if (!name.endsWith("-camera")) continue;
            const timing = anim.effect?.getTiming?.();
            cameraSpanMs = Math.max(
              cameraSpanMs,
              (Number(timing?.delay) || 0) + (Number(timing?.duration) || 0)
            );
          }
        }
        participantSpanMs = Math.max(participantSpanMs, cameraSpanMs);
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
        // (variantHasAnimation subsumes resolveVariantMotion's gate — see the
        // liveness floor below).
        const motionMs = (activeMotion!.delay + activeMotion!.duration) * 1000;
        TaskManger.anchorGate(
          flooredTaskId,
          Math.max(motionMs, participantSpanMs) + GATE_MOTION_MARGIN_MS
        );
      } else {
        TaskManger.markGateHeld(flooredTaskId);
      }
    }
    // HOW THIS FLIGHT IS FLOWN — one decision, resolved once (see
    // flightRouting.ts, where the evidence for each field lives).
    const routing = resolveFlightRouting({
      status,
      transition: currentTransition,
      skipAnimation,
      hasActiveMotion: !!activeMotion,
      hasAnimation
    });
    const {
      hasDrivableMotion,
      nativeSurgeryAllowed,
      touchGoverned: routedTouchGoverned,
      forceCompiled: routedForceCompiled,
      governedHead: routedGovernedHead,
      desktopHead: routedDesktopHead,
      governedSlide,
      birthHoldMs: governedBirthHoldMs
    } = routing;
    // Steady Chrome's ProMotion frame pacing for a compositor-driven flight
    // (see armFramePacingKeepalive): the idle main thread otherwise lets the
    // presentation drop and duplicate frames. Released in resolve() and in the
    // teardown below.
    if (routing.framePacingKeepalive) stopKeepalive = armFramePacingKeepalive();
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
    {
      const root = scope.ownerDocument.documentElement;
      const creepHeadProbe = routing.creepHead;
      if (creepHeadProbe) root.setAttribute(CREEP_ATTR, "true");
      else root.removeAttribute(CREEP_ATTR);
      if (routedGovernedHead) {
        root.setAttribute(GOVERNED_ATTR, "true");
      } else {
        root.removeAttribute(GOVERNED_ATTR);
      }
      // The desktop gate is the same mechanism one attribute over: a session is
      // either touch (LPM) or desktop Mac, never both, and the two heads carry
      // different literal lengths.
      if (routedDesktopHead) {
        root.setAttribute(DESK_HEAD_ATTR, "true");
      } else {
        root.removeAttribute(DESK_HEAD_ATTR);
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
      // AN END THAT RAN FOR NO TIME IS NOT AN END.
      //
      // `elapsedTime` is how long the animation actually ran. A real end
      // reports the flight's own active duration; zero means the animation was
      // torn down and rebuilt rather than finished, and WebKit reports that as
      // an `animationend` with the name, the keyframes and the duration all
      // still intact, so nothing else about the event tells the two apart.
      //
      // Resolving on one commits the store move and flips the screen to
      // COMPLETED while the motion is still at its from-pose: the navigation
      // lands, and what the eye gets is a cut. It is the same defect the morph
      // runtime was landing flights on, in the same shape, and the fix is the
      // same: wait for an end that ran.
      //
      // Guarded on there BEING a motion, because a variant with none of its
      // own (a `none` transition, a zero-duration step) legitimately ends in no
      // time at all — `resolveVariantMotion` returns null for exactly those.
      if (activeMotion && event.elapsedTime === 0) return;
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
    // variantHasAnimation SUBSUMES resolveVariantMotion's gate (a non-rest
    // variant with duration or delay > 0 — see variantMotion.ts — plus
    // something that actually interpolates), so the assertion can never fire.
    // One span, shared by the liveness floor and the recovery watchdog below.
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
    // The head delays the real motion, so every deadline derived from authored
    // time rides with it.
    const restartWatchdogMs = motionSpanMs + governedBirthHoldMs + 250;

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
          cutMs + 17 + governedBirthHoldMs
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
