import { animationName, easingToCss } from "@transition/compileTransitionStyles";

import type { Transition, TransitionVariant } from "@transition/typing";

// Stable view-transition-names the binding assigns to the entering / leaving
// screen scopes during a VT navigation (see the navigate store's
// `viewTransition` flag + ScreenMotion). One element holds each at a time, so
// fixed names are safe — the task queue serializes navigations.
export const VIEW_TRANSITION_NEW = "flemo-vt-new";
export const VIEW_TRANSITION_OLD = "flemo-vt-old";

const STYLE_ELEMENT_ID = "flemo-view-transition";

interface ViewTransitionLike {
  finished: Promise<void>;
}

export const supportsViewTransitions = (): boolean =>
  typeof document !== "undefined" &&
  typeof (document as { startViewTransition?: unknown }).startViewTransition === "function";

const variantDuration = (variant: { options?: { duration?: number } } | undefined): number => {
  const duration = variant?.options?.duration;
  return typeof duration === "number" && duration >= 0 ? duration : 0;
};

const variantDelay = (variant: { options?: { delay?: number } } | undefined): number => {
  const delay = variant?.options?.delay;
  return typeof delay === "number" && delay > 0 ? delay : 0;
};

// Build the `::view-transition-new/old` rules that drive the entering (new) and
// leaving (old) screen snapshots with the transition's already-compiled
// `@keyframes`. No new keyframes are generated — the same ones the CSS path uses
// are reused on the VT pseudo-elements, so a custom (e.g. blur / clip-path)
// transition animates on the GPU snapshot, decoupled from the main thread.
export const buildViewTransitionCss = (
  transition: Transition,
  newVariant: TransitionVariant,
  oldVariant: TransitionVariant
): string => {
  const rule = (pseudo: "new" | "old", name: string, variant: TransitionVariant): string => {
    const variantValue = transition.variants[variant];
    const keyframe = animationName("screen", transition.name, variant);
    const duration = variantDuration(variantValue);
    const delay = variantDelay(variantValue);
    const easing = easingToCss(variantValue?.options?.ease);
    const animation = [keyframe, `${duration}s`, easing, delay > 0 ? `${delay}s` : null, "both"]
      .filter(Boolean)
      .join(" ");
    return `::view-transition-${pseudo}(${name}) {\n  animation: ${animation};\n}`;
  };

  // Suppress the default root cross-fade. The transitioning screens are lifted
  // out of the root (named above), so the root snapshot is just the unchanging
  // page chrome — animating it would only risk a stray flash.
  const rootRule = "::view-transition-group(root) {\n  animation: none;\n}";

  return [
    rootRule,
    rule("new", VIEW_TRANSITION_NEW, newVariant),
    rule("old", VIEW_TRANSITION_OLD, oldVariant)
  ].join("\n");
};

// Run a navigation commit through the View Transitions API: inject the pseudo-
// element rules, snapshot + commit + animate, then drop the rules. Falls back to
// a plain synchronous commit when the API is unavailable. Framework-neutral —
// the caller supplies the `commit` (which a React binding wraps in flushSync).
export const runViewTransition = (css: string, commit: () => void): Promise<void> => {
  if (!supportsViewTransitions()) {
    commit();
    return Promise.resolve();
  }

  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  document.head.appendChild(style);

  const start = (
    document as unknown as { startViewTransition: (cb: () => void) => ViewTransitionLike }
  ).startViewTransition;
  const transition = start.call(document, commit);

  return transition.finished.catch(() => {}).finally(() => style.remove());
};
