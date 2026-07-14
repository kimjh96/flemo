import TaskManger from "@core/TaskManger";

import { clearInlineAnimation } from "@transition/animateInline";
import { animationName, variantHasAnimation } from "@transition/compileTransitionStyles";
import resolveTransition from "@transition/resolveTransition";

import type { TransitionVariant } from "@transition/typing";
import { resolveVariantMotion } from "@transition/variantMotion";

import driverPolicy from "@core/engine/driverPolicy";
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
  // Restart budget for the compiled-CSS liveness recovery (see the active path
  // below): task ids that have already spent their one animation restart. Keyed
  // by task id, NOT by effect run — the anim-hold release re-runs the driver
  // effect, and a per-run flag would hand the same transition a fresh restart
  // each re-run. Only a genuinely-recovered transition is ever recorded, so this
  // set tracks the (rare) signal-loss defect, not healthy navigations.
  const restartedTaskIds = new Set<string>();

  const driveScreenLifecycle = (input: ScreenLifecycleInput): (() => void) => {
    const { getElements, transitionName, prevTransitionName, status, isActive, animHoldReleased } =
      input;

    const isTransitional = status === "PUSHING" || status === "POPPING" || status === "REPLACING";

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
        const detach = joinPlayer(`${status}-false` as TransitionVariant, "passive");
        if (detach) return detach;
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

    const resolve = () => {
      const transitionTaskId = deps.getTransitionTaskId();
      if (transitionTaskId) {
        void TaskManger.resolveTask(transitionTaskId);
      }
    };

    const currentTransition = resolveTransition(transitionName);
    const variantKey = `${status}-true` as const;
    const skipAnimation = scope.getAttribute(SKIP_ANIMATION_ATTR) === "true";
    const hasAnimation = !skipAnimation && variantHasAnimation(currentTransition, variantKey);

    if (!hasAnimation) {
      // No animation will run for this variant. Resolve in a microtask so the
      // binding's commit lands first and the navigation queue keeps advancing.
      queueMicrotask(resolve);
      return noop;
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

    const onEnd = (event: AnimationEvent) => {
      if (event.target !== scope) return;
      if (event.animationName !== expectedName) return;
      scope.removeEventListener("animationend", onEnd);
      clearWatchdog();
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
    const flooredTaskId = deps.getTransitionTaskId();
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
    // the transition) fires NEITHER `animationend` nor a player onComplete;
    // without this the task hangs until the 1.2s gate and the screen snaps in
    // with no transition. The ladder: restart the animation ONCE, then let the
    // watchdog resolve if the restart is lost too. The liveness floor above and
    // the 1.2s task gate remain as untouched last resorts.
    const restartWatchdogMs = motionSpanMs + 250;

    const armWatchdog = () => {
      clearWatchdog();
      watchdog = setTimeout(runRecovery, restartWatchdogMs);
    };

    const runRecovery = () => {
      clearWatchdog();
      // No task to gate: nothing to recover or resolve.
      if (!flooredTaskId) return;
      const canRestart =
        // Still THIS transition (a newer navigation captured a new id).
        deps.getTransitionTaskId() === flooredTaskId &&
        scope.isConnected &&
        // A swipe that committed the exit sets SKIP_ANIMATION — no restart.
        scope.getAttribute(SKIP_ANIMATION_ATTR) !== "true" &&
        // The variant genuinely animates (guards a def with no motion).
        variantHasAnimation(currentTransition, variantKey) &&
        // Budget: at most one restart per task id (survives effect re-runs).
        !restartedTaskIds.has(flooredTaskId);
      if (canRestart) {
        restartedTaskIds.add(flooredTaskId);
        // Standard restart trick: drop the animation, force a reflow so the
        // removal takes, then restore it — the compiled rule replays from its
        // own `from` keyframe. Re-arm the watchdog for the restarted run.
        scope.style.animation = "none";
        void scope.offsetWidth;
        scope.style.removeProperty("animation");
        armWatchdog();
        return;
      }
      // Precondition failed or the restart was already spent: resolve now
      // rather than strand the task until the 1.2s gate.
      resolve();
    };

    const onCancel = (event: AnimationEvent) => {
      if (event.target !== scope) return;
      if (event.animationName !== expectedName) return;
      runRecovery();
    };

    const recovering = !detachPlayer && animHoldReleased;
    if (recovering) {
      scope.addEventListener("animationcancel", onCancel);
      // Arm on the transition INTO released (this effect re-runs when the hold
      // releases; a hold-free variant attaches with animHoldReleased already
      // true and arms here immediately).
      armWatchdog();
    }

    return () => {
      if (floor !== undefined) clearTimeout(floor);
      scope.removeEventListener("animationend", onEnd);
      if (recovering) scope.removeEventListener("animationcancel", onCancel);
      clearWatchdog();
      detachPlayer?.();
    };
  };

  return { driveScreenLifecycle };
}
