import { type PropsWithChildren } from "react";

import useNavigationStore from "@navigate/store";

import ScreenFreeze from "@screen/ScreenFreeze";
import ScreenMotion from "@screen/ScreenMotion";
import useScreenStore from "@screen/store";
import useScreen from "@screen/useScreen";

import type { HTMLMotionProps } from "motion/react";

function Screen({
  children,
  ...props
}: PropsWithChildren<
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
>) {
  const { isActive, isPrev } = useScreen();

  const status = useNavigationStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const replaceTransitionStatus = useScreenStore((state) => state.replaceTransitionStatus);

  const isTransitionCompleted =
    status === "COMPLETED" && dragStatus === "IDLE" && replaceTransitionStatus === "IDLE";
  const isFrozen =
    !isActive && (isTransitionCompleted || (isPrev && replaceTransitionStatus === "IDLE"));

  return (
    <ScreenFreeze freeze={isFrozen}>
      <ScreenMotion {...props}>{children}</ScreenMotion>
    </ScreenFreeze>
  );
}

export default Screen;
