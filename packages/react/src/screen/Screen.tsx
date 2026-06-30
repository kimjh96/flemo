import { type ComponentPropsWithoutRef, type PropsWithChildren, type ReactNode } from "react";

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

  const isFrozen = computeScreenFreeze({
    isActive,
    isPrev,
    zIndex,
    index,
    status,
    dragStatus,
    replaceTransitionStatus
  });

  return (
    <ScreenFreeze freeze={isFrozen}>
      <ScreenMotion {...props}>{children}</ScreenMotion>
    </ScreenFreeze>
  );
}

export default Screen;
