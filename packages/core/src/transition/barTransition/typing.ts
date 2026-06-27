import type { BaseTransition, SwipeAnimate } from "@transition/typing";

// User-augmentable registry of bar-transition names, mirroring RegisterRoute /
// RegisterDecorator. A binding (or the consumer) augments this to get typed
// `name` strings on `createBarTransition` and `<BarTransition name="...">`.
// eslint-disable-next-line
export interface RegisterBarTransition {}

export type BarTransitionName = RegisterBarTransition[keyof RegisterBarTransition] | (string & {});

// Imperative, per-frame hooks for the swipe (interactive) path. Each fires for a
// single `<BarTransition>` element with its `active` side, so the author maps the
// drag `progress` (0–100) onto that element's styles via `animate` — inline
// writes, no React re-render. The programmatic path needs none of this: the
// status×active variants compile to `@keyframes` that the compositor drives.
export type BarTransitionOptions = {
  onSwipeStart?: (
    triggered: boolean,
    options: { animate: SwipeAnimate; element: HTMLElement; active: boolean }
  ) => void;
  onSwipe?: (
    triggered: boolean,
    progress: number,
    options: { animate: SwipeAnimate; element: HTMLElement; active: boolean }
  ) => void;
  onSwipeEnd?: (
    triggered: boolean,
    options: { animate: SwipeAnimate; element: HTMLElement; active: boolean }
  ) => void;
};

// A bar transition is shaped exactly like a decorator's transition (status×active
// variants + swipe hooks); it differs only in how it's used — referenced by name
// on a `<BarTransition>` child element, not bound to a screen transition.
export interface BarTransition extends Omit<BaseTransition, "name">, BarTransitionOptions {
  name: BarTransitionName;
}
