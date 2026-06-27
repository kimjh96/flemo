import type { NavigateStatus } from "@navigate/store";

export interface ScreenFreezeInput {
  isActive: boolean;
  isPrev: boolean;
  zIndex: number;
  index: number;
  status: NavigateStatus;
  dragStatus: "IDLE" | "PENDING";
  replaceTransitionStatus: "IDLE" | "PENDING";
}

// Whether a screen should be frozen (kept mounted but display:none) so it holds
// its state without painting. Pure decision from the stack position + transition
// state: an inactive screen freezes once its transition settles, and a prev
// screen freezes once it's safely covered (guarding the replace flip). The
// binding renders the result. Framework-neutral.
export default function computeScreenFreeze(input: ScreenFreezeInput): boolean {
  const isTransitionCompleted = input.status === "COMPLETED" && input.dragStatus === "IDLE";
  return (
    (!input.isActive && isTransitionCompleted) ||
    (input.isPrev && input.index - 2 <= input.zIndex && input.replaceTransitionStatus === "IDLE") ||
    (input.isPrev && input.index - 2 > input.zIndex)
  );
}
