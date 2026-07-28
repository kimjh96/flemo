import {
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type PropsWithChildren,
  type ReactNode
} from "react";

import { computeScreenFreeze } from "@flemo/core";

import ScreenFreeze from "@screen/ScreenFreeze";
import ScreenMotion from "@screen/ScreenMotion";
import useScreen from "@screen/useScreen";

import useHistoryStore from "@stores/useHistoryStore";
import useNavigateStore from "@stores/useNavigateStore";
import useScreenStore from "@stores/useScreenStore";

export interface ScreenProps extends PropsWithChildren<
  Omit<
    ComponentPropsWithoutRef<"div">,
    "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"
  >
> {
  statusBarHeight?: string;
  statusBarColor?: string;
  systemNavigationBarHeight?: string;
  systemNavigationBarColor?: string;
  backgroundColor?: string;
  sharedTopBar?: ReactNode;
  sharedBottomBar?: ReactNode;
  topBar?: ReactNode;
  bottomBar?: ReactNode;
  hideStatusBar?: boolean;
  hideSystemNavigationBar?: boolean;
  contentScrollable?: boolean;
}

function Screen({ children, ...props }: ScreenProps) {
  const { isActive, isPrev, zIndex } = useScreen();

  const index = useHistoryStore((state) => state.index);
  const status = useNavigateStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const replaceTransitionStatus = useScreenStore((state) => state.replaceTransitionStatus);

  const shouldFreeze = computeScreenFreeze({
    isActive,
    isPrev,
    zIndex,
    index,
    status,
    dragStatus,
    replaceTransitionStatus
  });

  // Freezing is DEFERRED; unfreezing is immediate. The freeze (Activity
  // hidden) is a large commit — it disconnects the covered screen's whole
  // effect tree — and applying it at the COMPLETED flip stacks that commit
  // onto the exact frames the eye watches settle. Measured on-device (paired
  // A/B over 117 flights): the convergence window drops ~0.2 frames per
  // flight with or without the arrival hold's landing, so THIS commit is the
  // remaining convergence load. The screen is already covered, so freezing
  // late is invisible; the timer re-arms whenever a new transition starts,
  // so the commit only ever lands in a quiet window. Mounting-deep screens
  // (already covered, no eye on them) freeze immediately.
  const [frozen, setFrozen] = useState(shouldFreeze);
  if (!shouldFreeze && frozen) {
    // Render-phase adjustment: a pop destination must wake in THIS commit.
    setFrozen(false);
  }
  useEffect(() => {
    if (!shouldFreeze || frozen) return undefined;
    if (status !== "COMPLETED") return undefined;
    const timer = setTimeout(() => setFrozen(true), FREEZE_DEFER_MS);
    return () => clearTimeout(timer);
  }, [shouldFreeze, frozen, status]);

  return (
    <ScreenFreeze freeze={frozen}>
      <ScreenMotion {...props}>{children}</ScreenMotion>
    </ScreenFreeze>
  );
}

// How long past the convergence the covered screen keeps its live (but
// invisible) state before the freeze commit lands. Comfortably past the
// settle window the eye still watches (drops measured at 400-700ms into
// 600ms flights) while short enough that a covered screen never accumulates
// meaningful background work.
const FREEZE_DEFER_MS = 600;

export default Screen;
