import type { TransitionTarget } from "@transition/cssTypes";

// Whether a transition's `initial` variant leaves the entering screen invisible
// on its first frame: fully transparent (`opacity: 0`), or translated off-screen
// by at least 100% on either axis. Only then can the binding defer the screen's
// content one commit (so the keyframe starts on a light paint) without ever
// flashing an empty box. A partial fade or scale that stays on-screen (e.g. the
// `layout` preset's `opacity: 0.97`, or `scale: 0.95`) returns false, so its
// content renders immediately. Non-percent translate units are treated
// conservatively as "not hidden". Framework-neutral.
export default function initialHidesScreen(initial: TransitionTarget | undefined): boolean {
  if (!initial) return false;
  if (initial.opacity === 0) return true;
  const offscreen = (value: string | number | undefined) =>
    typeof value === "string" && value.trim().endsWith("%") && Math.abs(parseFloat(value)) >= 100;
  return offscreen(initial.x) || offscreen(initial.y);
}
