import type { BaseTransition, SwipeAnimate } from "@transition/typing";

// User-augmentable registry of part-transition names, mirroring RegisterRoute /
// RegisterDecorator. A binding (or the consumer) augments this to get typed
// `name` strings on `createPartTransition` and `<Part name="...">`.
// eslint-disable-next-line
export interface RegisterPartTransition {}

export type PartTransitionName =
  RegisterPartTransition[keyof RegisterPartTransition] | (string & {});

// Imperative, per-frame hooks for the swipe (interactive) path. Each fires for a
// single `<PartTransition>` element with its `active` side, so the author maps the
// drag `progress` (0–100) onto that element's styles via `animate` — inline
// writes, no React re-render. The programmatic path needs none of this: the
// status×active variants compile to `@keyframes` that the compositor drives.
export type PartTransitionOptions = {
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

// A part-transition is shaped exactly like a decorator's transition (status×active
// variants + swipe hooks); it differs only in how it's used — referenced by name
// on a `<PartTransition>` child element, not bound to a screen transition.
export interface PartTransition extends Omit<BaseTransition, "name">, PartTransitionOptions {
  name: PartTransitionName;
}
