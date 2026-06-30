import { Activity, type ReactNode } from "react";

interface ScreenFreezeProps {
  freeze: boolean;
  children: ReactNode;
}

// An inactive screen is kept mounted so it preserves its DOM state — scroll
// position, form values, media playback — and restores instantly when shown
// again. React's <Activity> handles this: in "hidden" mode it hides the screen
// (display:none on its host nodes, so the DOM and its scroll offset survive) and
// unmounts its effects, then on "visible" it remounts the effects without losing
// that state. This replaces the manual display:none wrapper and frozen-children
// snapshot with React's built-in offscreen handling.
function ScreenFreeze({ freeze, children }: ScreenFreezeProps) {
  return <Activity mode={freeze ? "hidden" : "visible"}>{children}</Activity>;
}

export default ScreenFreeze;
