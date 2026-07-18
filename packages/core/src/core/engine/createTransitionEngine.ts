import TaskManger from "@core/TaskManger";

import { clearInlineAnimation } from "@transition/animateInline";
import { animationName, variantHasAnimation } from "@transition/compileTransitionStyles";
import resolveTransition from "@transition/resolveTransition";

import type { TransitionVariant } from "@transition/typing";
import { resolveVariantMotion, type VariantMotion } from "@transition/variantMotion";

import createArrivalHold from "@core/engine/arrivalHold";
import driverPolicy from "@core/engine/driverPolicy";
import { perceptualCutMs } from "@core/engine/perceptualSpan";
import transitionPlayers from "@core/engine/transitionPlayer";
import {
  SKIP_ANIMATION_ATTR,
  type ScreenLifecycleInput,
  type TransitionEngine,
  type TransitionEngineDeps
} from "@core/engine/types";
import { decoratorMap } from "@transition/decorator/decorator";
import { partTransitionMap } from "@transition/partTransition/partTransition";

const noop = () => {};

const PART_NAME_ATTR = "data-flemo-part-name";

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
  // The original start on the compiled timeline, set once at the FIRST
  // `animationstart`. A resume's negative-delay replay fires a fresh
  // `animationstart` that must NOT move it; only a watchdog full-restart resets
  // it (fullRestart below).
  let originalStart: number | null = null;
  // True only during our own drop-reflow-restore mutation, so a synchronous
  // cancel/start the real compositor emits from it is ignored (jsdom fires
  // neither, but the guard keeps the browser path re-entrancy-safe).
  let midRestart = false;

  // Standard restart trick (drop → reflow → restore the compiled rule), with
  // one of three treatments for the inline rejoin delay:
  //   "keep"  — leave it untouched (a plain restart of an animation that never
  //             started on the clock, so there's no rejoin delay to manage);
  //   "set"   — write the negative/positive delay that rejoins the clock;
  //   "clear" — strip any rejoin delay (a watchdog full-restart from `from`).
  const restart = (delay: { mode: "keep" | "clear" } | { mode: "set"; seconds: number }) => {
    midRestart = true;
    element.style.animation = "none";
    void element.offsetWidth;
    element.style.removeProperty("animation");
    if (delay.mode === "clear") element.style.removeProperty("animation-delay");
    else if (delay.mode === "set") element.style.animationDelay = cssSeconds(delay.seconds);
    midRestart = false;
  };

  const onStart = (event: AnimationEvent) => {
    if (midRestart) return;
    if (event.target !== element || event.animationName !== expectedName) return;
    if (originalStart !== null) return; // a resumed animation's fresh start
    originalStart = performance.now();
  };

  const onCancel = (event: AnimationEvent) => {
    if (midRestart) return;
    if (event.target !== element || event.animationName !== expectedName) return;
    if (!config.isLive() || config.budgetUsed() >= RESUME_BUDGET) {
      config.onTerminal();
      return;
    }
    if (originalStart === null) {
      // Never observed on the compiled clock: plain restart, no delay change.
      config.spendBudget();
      restart({ mode: "keep" });
      return;
    }
    const elapsedMs = performance.now() - originalStart;
    const spanMs = (motion.delay + motion.duration) * 1000;
    if (elapsedMs >= spanMs) {
      // Past the end — the compiled rest rule owns the pose, nothing to resume.
      config.onTerminal();
      return;
    }
    config.spendBudget();
    // delay - elapsed: negative once past the delay phase (rejoin mid-flight),
    // positive if cancelled while still delaying (wait out the remainder).
    restart({ mode: "set", seconds: motion.delay - elapsedMs / 1000 });
  };

  return {
    // Attach is explicit so the active scope can construct the controller (the
    // watchdog needs its fullRestart) without wiring listeners on the
    // player-driven path, where they'd catch the join's own `animation: none`.
    attach: () => {
      element.addEventListener("animationstart", onStart);
      element.addEventListener("animationcancel", onCancel);
    },
    detach: () => {
      element.removeEventListener("animationstart", onStart);
      element.removeEventListener("animationcancel", onCancel);
    },
    // Watchdog full-restart: replay from the compiled `from` on a FRESH clock
    // (the next `animationstart` re-records it), dropping any rejoin delay.
    fullRestart: () => {
      originalStart = null;
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
  // moment (status re-renders, freeze of the covered screen, quarantine
  // release); landing the held content there stacks a large reveal commit
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

    // No content landing while the screen is in motion: the COLD side of a
    // navigation (freshly-mounted enter on push/replace, unfreezing pop
    // destination — the screens whose async data can resolve mid-flight)
    // holds in-flight DOM swaps and reflects them at rest. Armed only once
    // the anim-hold has released: before that the screen is parked under a
    // cover, so a landing is invisible and reflecting it immediately is
    // strictly better (content is ready earlier at zero visual cost).
    const holdsArrivals =
      isTransitional &&
      animHoldReleased &&
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
      if (scope) releaseArrivalHold = createArrivalHold(scope);
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
      //    back/forward storm) runs on the compiled CSS path BY DESIGN: the
      //    queued screens' mount commits land mid-flight, which stalls a
      //    main-thread player but is precisely where the compositor glides.
      //    Single interactive navigations (the common case) get the player,
      //    whose smoothness on raster-heavy layers the compositor can't match.
      if (TaskManger.pendingTaskIds.some((id) => id !== taskId)) return null;
      // 2. A device whose main thread chronically starves the player even on
      //    single navigations (measured by the player's own frame gaps)
      //    earned a demotion; CSS drives everything there, as it always did.
      if (!driverPolicy.playerAllowed()) return null;

      const { scope, decorator, bars } = getElements();
      if (!scope) return null;

      const transition = resolveTransition(transitionName);
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
          if (bar) clearInlineAnimation(bar);
        }
        return noop;
      }
      // A prev screen entering a differently-transitioned replace flips the
      // replace-transition status so its own rules can resolve in step.
      const isTransitionDiffOnReplace = prevTransitionName !== transitionName;
      if (status === "REPLACING" && isTransitionDiffOnReplace) {
        deps.setReplaceTransitionStatus("PENDING");
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
        if (!bar) continue;
        clearInlineAnimation(bar);
        bar.style.removeProperty("will-change");
      }
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
        const passiveVariant = `${status}-false` as TransitionVariant;
        if (variantHasAnimation(currentTransition, passiveVariant)) {
          if (!animHoldReleased) {
            // Wait for the release commit; this effect re-runs with
            // animHoldReleased=true and arms the span then.
            if (flooredTaskId) TaskManger.markGateHeld(flooredTaskId);
            return noop;
          }
          if (flooredTaskId) TaskManger.anchorGate(flooredTaskId);
          const passiveMotion = resolveVariantMotion(currentTransition, passiveVariant)!;
          const spanMs = (passiveMotion.delay + passiveMotion.duration) * 1000 + 50;
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
    if (flooredTaskId) {
      if (animHoldReleased) {
        TaskManger.anchorGate(flooredTaskId);
      } else {
        TaskManger.markGateHeld(flooredTaskId);
      }
    }

    const activeMotion = resolveVariantMotion(currentTransition, variantKey);
    const playerCanDrive = !skipAnimation && !!activeMotion;

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
      if (event.animationName !== expectedName) return;
      scope.removeEventListener("animationend", onEnd);
      clearWatchdog();
      stopScopeRecovery();
      resolve();
    };
    scope.addEventListener("animationend", onEnd);

    // Additive rAF driving: only once the hold has released (the compiled
    // hold/park rules own the pre-release frames). A chain-gated or
    // non-joinable variant simply keeps the compiled animation + `onEnd`.
    const detachPlayer =
      playerCanDrive && animHoldReleased ? joinPlayer(variantKey, "active", resolve) : null;

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
    const settleMs = motionSpanMs + 1500;
    const floor = flooredTaskId
      ? setTimeout(() => void TaskManger.resolveTask(flooredTaskId), settleMs)
      : undefined;

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

    // Perceptual completion cut (see perceptualSpan.ts): once every animated
    // channel of BOTH sides has permanently entered its imperceptibility band
    // (< 1 device pixel / < one opacity step remaining), the rest of the
    // clock presents nothing — resolve there and skip the sub-pixel shimmer
    // window. Compiled-CSS path only (the player owns its own tail), armed at
    // the release (the same commit that unpauses the animation), and DISARMED
    // the moment recovery touches the clock (a cancel-resume or watchdog
    // restart shifts presentation later than the wall-clock cut). <Part>
    // choreography runs on its own registered timings this analysis cannot
    // see, so any participating part vetoes the cut.
    let perceptualCut: ReturnType<typeof setTimeout> | undefined;
    const clearPerceptualCut = () => {
      if (perceptualCut === undefined) return;
      clearTimeout(perceptualCut);
      perceptualCut = undefined;
    };
    disarmPerceptualCut = clearPerceptualCut;
    if (recovering && flooredTaskId && collectVariantParts(scope, variantKey).length === 0) {
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const activeCut = perceptualCutMs(activeMotion!, scope, dpr);
      const passiveVariant = `${status}-false` as TransitionVariant;
      const passiveMotion = variantHasAnimation(currentTransition, passiveVariant)
        ? resolveVariantMotion(currentTransition, passiveVariant)
        : null;
      // Both sides must be inside their bands before the COMPLETED flip cuts
      // them; an unanalyzable passive side vetoes. (Passive % distances
      // resolve against this scope's box — sibling screens share the
      // viewport.)
      const passiveCut = passiveMotion ? perceptualCutMs(passiveMotion, scope, dpr) : 0;
      if (activeCut !== null && passiveCut !== null) {
        const cutMs = Math.max(activeCut, passiveCut);
        perceptualCut = setTimeout(() => {
          perceptualCut = undefined;
          if (!scopeIsLive()) return;
          scope.removeEventListener("animationend", onEnd);
          clearWatchdog();
          stopScopeRecovery();
          resolve();
        }, cutMs + 17);
      }
    }

    return () => {
      if (floor !== undefined) clearTimeout(floor);
      clearPerceptualCut();
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
