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

export interface ContainerClip {
  rect: DOMRect;
  radius: string;
}

// flemo's clipping container — the nearest ancestor of a mounted screen that
// clips overflow (e.g. a phone-frame wrapper) — as its viewport rect + corner
// radius. The VT pseudo tree lives on the document top layer and is NOT clipped
// by this container, so each lifted element is clipped back to its shape.
// `null` when flemo fills the viewport (no clipping ancestor) — then nothing can
// escape and no clip is needed.
export const getContainerClip = (
  scope: Element | null | undefined = typeof document === "undefined"
    ? null
    : document.querySelector("[data-flemo-screen]")
): ContainerClip | null => {
  // An unset overflow computes to "visible" in browsers but "" in jsdom; treat
  // both as non-clipping.
  const isVisible = (value: string) => value === "" || value === "visible";

  let el = scope?.parentElement ?? null;
  while (el) {
    const style = getComputedStyle(el);
    const clips =
      !isVisible(style.overflow) || !isVisible(style.overflowX) || !isVisible(style.overflowY);
    if (clips) {
      return { rect: el.getBoundingClientRect(), radius: style.borderRadius || "0px" };
    }
    el = el.parentElement;
  }
  return null;
};

// Clip an element's VT group to the container's SHAPE: a box clip (`inset(0)`)
// that rounds ONLY the corners where the element sits exactly at one of the
// container's corners — so the container's rounded corners are matched and the
// snapshot's square corners don't poke past them. An element away from an edge
// keeps square corners there (it's inside the container, so it can't escape
// anyway). Position-agnostic: a full-bleed screen rounds all four, a top bar the
// top two, a bottom bar the bottom two, a margined bar none.
const containerCornerClip = (el: Element, container: ContainerClip): string => {
  const e = el.getBoundingClientRect();
  const c = container.rect;
  const T = 1.5; // px tolerance for "at the edge"
  const corner = (atVertical: boolean, atHorizontal: boolean) =>
    atVertical && atHorizontal ? container.radius : "0px";
  const tl = corner(Math.abs(e.top - c.top) < T, Math.abs(e.left - c.left) < T);
  const tr = corner(Math.abs(e.top - c.top) < T, Math.abs(e.right - c.right) < T);
  const br = corner(Math.abs(e.bottom - c.bottom) < T, Math.abs(e.right - c.right) < T);
  const bl = corner(Math.abs(e.bottom - c.bottom) < T, Math.abs(e.left - c.left) < T);
  return `inset(0 round ${tl} ${tr} ${br} ${bl})`;
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

  // Clip every lifted element back to flemo's container. The ::view-transition
  // pseudo tree lives on the document top layer and does NOT inherit the
  // container's overflow/border-radius clipping, so without this the snapshots
  // (square corners, blur halo, edge content) escape it. Each group is clipped
  // to the container's shape via `containerCornerClip`, which rounds only the
  // corners that sit at the container's corners — robust for screens AND the
  // shared bars at any edge. No clip when flemo fills the viewport.
  const container = typeof document === "undefined" ? null : getContainerClip();
  const clipRules: string[] = [];
  if (container) {
    // Screens fill the container (all four corners).
    clipRules.push(
      `::view-transition-group(${VIEW_TRANSITION_NEW}),\n` +
        `::view-transition-group(${VIEW_TRANSITION_OLD}) {\n  clip-path: inset(0 round ${container.radius});\n}`
    );
    // Shared bars (when present) clip to the edge they sit on, and DON'T animate:
    // they're pinned. The default shared-element cross-fade blends the old + new
    // snapshots with `mix-blend-mode: plus-lighter` (additive), so merely
    // stopping the animation leaves BOTH at full opacity → they sum to a washed-
    // out flicker. Instead, hide the old snapshot and show only the new at full
    // opacity with normal compositing — the bar stays crisp and still.
    // `z-index` lifts the bar group ABOVE the screen groups: the entering screen
    // (a non-composited transition fades/blurs in semi-transparent) otherwise
    // paints OVER the pinned bar, showing it faintly through itself — the
    // remaining "bar flicker". With the bar on top, only its own (opaque, non-
    // animated, old-hidden) snapshot shows, crisp and still.
    const barRules = (bar: string, el: Element) =>
      `::view-transition-group(${bar}) {\n  clip-path: ${containerCornerClip(el, container)};\n  z-index: 2147483647;\n}\n` +
      `::view-transition-image-pair(${bar}) {\n  isolation: auto;\n}\n` +
      `::view-transition-old(${bar}) {\n  animation: none;\n  mix-blend-mode: normal;\n  opacity: 0;\n}\n` +
      `::view-transition-new(${bar}) {\n  animation: none;\n  mix-blend-mode: normal;\n  opacity: 1;\n}`;

    const appBar = document.querySelector('[data-flemo-bar="app"]');
    if (appBar) clipRules.push(barRules("flemo-vt-app-bar", appBar));
    const navBar = document.querySelector('[data-flemo-bar="nav"]');
    if (navBar) clipRules.push(barRules("flemo-vt-nav-bar", navBar));
  }

  return [
    rootRule,
    ...clipRules,
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
