import {
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type PropsWithChildren,
  type ReactNode
} from "react";

import { computeScreenFreezeMode, type SharedBarId } from "@flemo/core";

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
  sharedTopBarId?: SharedBarId;
  sharedBottomBar?: ReactNode;
  sharedBottomBarId?: SharedBarId;
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

  const freezeMode = computeScreenFreezeMode({
    isActive,
    isPrev,
    zIndex,
    index,
    status,
    dragStatus,
    replaceTransitionStatus
  });

  // Only the JUST-COVERED screen's freeze is deferred; a DEEP screen freezes
  // in this very commit and a participant wakes in this very commit. The
  // deferral exists because the freeze (Activity hidden) is a large commit —
  // it disconnects the covered screen's whole effect tree — and applying it
  // at the COMPLETED flip stacks that commit onto the exact frames the eye
  // watches settle (measured on-device, paired A/B over 117 flights: ~0.2
  // dropped frames per flight from this commit alone). The deferral timer
  // re-arms whenever a new transition starts, so it only ever lands in a
  // quiet window — which is exactly why it must NOT govern deep screens: a
  // rapid push storm never offers a quiet window, and deferring the deep
  // freezes let 15-20 live full-screen layers accumulate (whole-app flicker
  // at depth). Deep screens were already covered before the transition
  // began, so their freeze commit races nothing.
  const [frozen, setFrozen] = useState(freezeMode !== "live");
  if (freezeMode === "live" && frozen) {
    // Render-phase adjustment: a pop destination must wake in THIS commit.
    setFrozen(false);
  }
  if (freezeMode === "immediate" && !frozen) {
    // Render-phase adjustment: a screen that just became deep freezes in
    // THIS commit — its cover has been up for a full transition already.
    setFrozen(true);
  }
  useEffect(() => {
    if (freezeMode !== "deferred" || frozen) return undefined;
    const timer = setTimeout(() => setFrozen(true), FREEZE_DEFER_MS);
    return () => clearTimeout(timer);
  }, [freezeMode, frozen]);

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
