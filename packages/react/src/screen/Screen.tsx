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
  /**
   * Covered: stop painting this screen, from this commit. Written by the
   * binding, never by a consumer — the prop exists so <Screen> can hand the
   * decision to the container ScreenMotion renders.
   */
  paintHidden?: boolean;
  /** Height reserved above the top bar for the platform status bar. */
  statusBarHeight?: string;
  /** Fill painted behind the reserved status bar area. */
  statusBarColor?: string;
  /** Height reserved below the bottom bar for the platform navigation bar. */
  systemNavigationBarHeight?: string;
  /** Fill painted behind the reserved system navigation bar area. */
  systemNavigationBarColor?: string;
  /**
   * The screen's own surface color. flemo probes the computed value, and a
   * verifiably opaque surface is what lets the partner screen park during a
   * flight instead of holding paused. A transparent screen box gives that up.
   */
  backgroundColor?: string;
  /**
   * A top bar rendered BESIDE the screen box rather than inside it, so it can
   * stay still while the screen moves. Give the matching bar on both screens the
   * same `sharedTopBarId` and it hands over seamlessly; otherwise it rides along
   * with its screen.
   */
  sharedTopBar?: ReactNode;
  /**
   * Identity of the shared top bar. Two bars hand over only when their ids are
   * equal. Two unlabelled bars still match by position, but a labelled bar never
   * matches an unlabelled one.
   */
  sharedTopBarId?: SharedBarId;
  /** A bottom bar rendered beside the screen box. See `sharedTopBar`. */
  sharedBottomBar?: ReactNode;
  /** Identity of the shared bottom bar. See `sharedTopBarId`. */
  sharedBottomBarId?: SharedBarId;
  /**
   * A top bar rendered INSIDE the screen box. It moves with the screen and can
   * never stay still across a navigation; use `sharedTopBar` for chrome that
   * should appear continuous.
   */
  topBar?: ReactNode;
  /** A bottom bar rendered inside the screen box. See `topBar`. */
  bottomBar?: ReactNode;
  /** Drops the reserved status bar area for this screen. */
  hideStatusBar?: boolean;
  /** Drops the reserved system navigation bar area for this screen. */
  hideSystemNavigationBar?: boolean;
  /**
   * Whether the content area scrolls (default `true`). Set `false` to scroll the
   * whole screen box, bars included, instead.
   */
  contentScrollable?: boolean;
}

/**
 * One screen of a Router's stack: the surface, its bars, and its motion.
 *
 * A screen carries a transform while it moves, which makes it a containing
 * block and a stacking context for everything inside it. Chrome that must stay
 * still across a navigation therefore goes in `sharedTopBar` or
 * `sharedBottomBar`, and an overlay that must cover those bars goes in `Layer`.
 * Elements that move independently within the screen or its shared chrome are
 * `Part` elements.
 */
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
    <ScreenFreeze freeze={frozen} mode={freezeMode}>
      <ScreenMotion paintHidden={frozen} {...props}>
        {children}
      </ScreenMotion>
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
