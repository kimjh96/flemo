import type { ReactNode, PropsWithChildren } from "react";

import { AnimatePresence, type HTMLMotionProps } from "motion/react";

import useHistoryStore from "@history/store";
import useNavigationStore from "@navigate/store";
import ScreenFreeze from "@screen/ScreenFreeze";
import ScreenMotion from "@screen/ScreenMotion";
import useScreenStore from "@screen/store";

import useScreen from "@screen/useScreen";

export interface LayoutScreenProps
  extends PropsWithChildren<
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
  appBar?: ReactNode;
  navigationBar?: ReactNode;
}

function LayoutScreen({ children, ...props }: LayoutScreenProps) {
  const { isActive, isPrev, zIndex } = useScreen();

  const index = useHistoryStore((state) => state.index);
  const status = useNavigationStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const replaceTransitionStatus = useScreenStore((state) => state.replaceTransitionStatus);

  const isTransitionCompleted = status === "COMPLETED" && dragStatus === "IDLE";
  const isFrozen =
    (!isActive && isTransitionCompleted) ||
    (isPrev && index - 2 <= zIndex && replaceTransitionStatus === "IDLE") ||
    (isPrev && index - 2 > zIndex);

  return (
    <ScreenFreeze freeze={isFrozen}>
      <ScreenMotion
        {...props}
        style={{
          backgroundColor: "transparent",
          ...props.style
        }}
      >
        <AnimatePresence>{children}</AnimatePresence>
      </ScreenMotion>
    </ScreenFreeze>
  );
}

export default LayoutScreen;
