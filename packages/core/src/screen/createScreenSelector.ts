import type { History } from "@history/store";

import type { TransitionName } from "@transition/typing";

// A history entry plus its render-position metadata. Everything the renderer
// needs to place a screen EXCEPT `routePath`, which a binding resolves from its
// own route declarations (React children, etc.).
export interface ScreenSelection extends History {
  isActive: boolean;
  isRoot: boolean;
  isPrev: boolean;
  zIndex: number;
  prevTransitionName: TransitionName;
}

// Pure derivation of which screens mount and how they stack, from the history
// stack + current index. Framework-neutral: a binding maps the result to its
// own screen elements. `transitionName` is the active top's (every screen in a
// transition shares it), `prevTransitionName` the screen below the top's.
export default function createScreenSelector(
  histories: History[],
  index: number
): ScreenSelection[] {
  return histories.map((history, zIndex) => ({
    ...history,
    isActive: zIndex === index,
    isRoot: zIndex === 0,
    isPrev: zIndex < index - 1,
    zIndex,
    transitionName: histories[index].transitionName,
    prevTransitionName: histories[index - 1]?.transitionName
  }));
}
