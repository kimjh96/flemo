import { type ComponentPropsWithoutRef, type PropsWithChildren, type ReactNode } from "react";

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
  const status = useNavigateStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const replaceTransitionStatus = useScreenStore((state) => state.replaceTransitionStatus);

  const isTransitionCompleted = status === "COMPLETED" && dragStatus === "IDLE";
  const isFrozen =
    (!isActive && isTransitionCompleted) ||
    (isPrev && index - 2 <= zIndex && replaceTransitionStatus === "IDLE") ||
    (isPrev && index - 2 > zIndex);

  return (
    <ScreenFreeze freeze={isFrozen}>
      <ScreenMotion {...props}>{children}</ScreenMotion>
    </ScreenFreeze>
  );
}

export default Screen;
