import type { NavigateStatus } from "@navigate/store";

import type { InitialTarget } from "@transition/cssTypes";

export interface EnteringInitialStyleInput {
  initial: InitialTarget;
  isActive: boolean;
  status: NavigateStatus;
}

// The inline style holding an actively entering screen at its transition's
// `initial` value for the very first styled frame, before the compiled
// animation applies. Only the actively entering screen needs it; everything
// else either has a CSS rest rule applying (IDLE/COMPLETED) or is in the
// middle of an animation whose keyframe `from` block already enforces the
// entry value. Framework-neutral: bindings spread the result into the scope's
// inline style.
export default function enteringInitialStyle(input: EnteringInitialStyleInput): {
  transform?: string;
  opacity?: string;
} {
  const { initial, isActive, status } = input;
  if (!isActive) return {};
  if (status !== "PUSHING" && status !== "REPLACING") return {};
  const initialDecls: { transform?: string; opacity?: string } = {};
  if (typeof initial.x === "number") initialDecls.transform = `translateX(${initial.x}px)`;
  if (typeof initial.x === "string") initialDecls.transform = `translateX(${initial.x})`;
  if (typeof initial.y === "number") initialDecls.transform = `translateY(${initial.y}px)`;
  if (typeof initial.y === "string") initialDecls.transform = `translateY(${initial.y})`;
  if (typeof initial.opacity === "number") initialDecls.opacity = `${initial.opacity}`;
  return initialDecls;
}
