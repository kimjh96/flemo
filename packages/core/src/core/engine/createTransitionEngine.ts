import TaskManger from "@core/TaskManger";

import { clearInlineAnimation } from "@transition/animateInline";
import { animationName, variantHasAnimation } from "@transition/compileTransitionStyles";
import resolveTransition from "@transition/resolveTransition";

import {
  SKIP_ANIMATION_ATTR,
  type ScreenLifecycleInput,
  type TransitionEngine,
  type TransitionEngineDeps
} from "@core/engine/types";

const noop = () => {};

// Framework-neutral transition engine. Created once per router scope with a
// minimal set of injected store callbacks; the binding (React, etc.) feeds it
// plain DOM elements and the current transition state. The engine owns the
// hard, reusable part: when the navigation task resolves and what gets cleaned
// up. Declarative output (data-attributes, initial/content styles) stays in the
// binding's render. This is a faithful port of the former ScreenMotion lifecycle
// effect, so any binding that drives the same elements gets identical behavior.
export default function createTransitionEngine(deps: TransitionEngineDeps): TransitionEngine {
  const driveScreenLifecycle = (input: ScreenLifecycleInput): (() => void) => {
    const { getElements, transitionName, prevTransitionName, status, isActive } = input;

    if (!isActive) {
      // A prev screen entering a differently-transitioned replace flips the
      // replace-transition status so its own rules can resolve in step.
      const isTransitionDiffOnReplace = prevTransitionName !== transitionName;
      if (status === "REPLACING" && isTransitionDiffOnReplace) {
        deps.setReplaceTransitionStatus("PENDING");
      }
      return noop;
    }

    if (status === "COMPLETED") {
      deps.setDragStatus("IDLE");
      deps.setReplaceTransitionStatus("IDLE");
      // Strip inline styles a swipe (or interleaved navigation) may have left
      // on this screen and its related elements, so the next push/pop runs
      // against the compiled CSS rest rule on a clean slate.
      const { scope, decorator, bars } = getElements();
      if (scope) {
        clearInlineAnimation(scope);
        scope.removeAttribute(SKIP_ANIMATION_ATTR);
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
      // No CSS animation will fire. Resolve in a microtask so the binding's
      // commit lands first and the navigation queue keeps advancing.
      queueMicrotask(resolve);
      return noop;
    }

    const expectedName = animationName("screen", transitionName, variantKey);
    const onEnd = (event: AnimationEvent) => {
      if (event.target !== scope) return;
      if (event.animationName !== expectedName) return;
      scope.removeEventListener("animationend", onEnd);
      resolve();
    };

    scope.addEventListener("animationend", onEnd);
    return () => {
      scope.removeEventListener("animationend", onEnd);
    };
  };

  return { driveScreenLifecycle };
}
