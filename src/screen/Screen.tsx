import { Activity, type PropsWithChildren, type ReactNode } from "react";

import useHistoryStore from "@history/store";
import useNavigationStore from "@navigate/store";

import ScreenMotion from "@screen/ScreenMotion";
import useScreenStore from "@screen/store";
import useScreen from "@screen/useScreen";

import type { HTMLMotionProps } from "motion/react";

export interface ScreenProps extends PropsWithChildren<
  Omit<
    HTMLMotionProps<"div">,
    | "initial"
    | "drag"
    | "dragControls"
    | "dragListener"
    | "onDragStart"
    | "onDrag"
    | "onDragEnd"
    | "onPointerDown"
    | "onPointerMove"
    | "onPointerUp"
  >
> {
  statusBarHeight?: string;
  statusBarColor?: string;
  systemNavigationBarHeight?: string;
  systemNavigationBarColor?: string;
  backgroundColor?: string;
  sharedAppBar?: ReactNode;
  sharedNavigationBar?: ReactNode;
  appBar?: ReactNode;
  navigationBar?: ReactNode;
  hideStatusBar?: boolean;
  hideSystemNavigationBar?: boolean;
  contentScrollable?: boolean;
}

function Screen({ children, ...props }: ScreenProps) {
  const { isActive, isPrev, zIndex } = useScreen();

  const index = useHistoryStore((state) => state.index);
  const status = useNavigationStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const replaceTransitionStatus = useScreenStore((state) => state.replaceTransitionStatus);

  const isTransitionCompleted = status === "COMPLETED" && dragStatus === "IDLE";
  const isHidden =
    (!isActive && isTransitionCompleted) ||
    (isPrev && index - 2 <= zIndex && replaceTransitionStatus === "IDLE") ||
    (isPrev && index - 2 > zIndex);

  return (
    <ScreenMotion {...props}>
      <Activity mode={isHidden ? "hidden" : "visible"}>{children}</Activity>
    </ScreenMotion>
  );
}

export default Screen;
