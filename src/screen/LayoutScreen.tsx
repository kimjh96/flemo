import { type PropsWithChildren } from "react";

import { AnimatePresence, type HTMLMotionProps } from "motion/react";

import useNavigationStore from "@navigate/store";
import ScreenFreeze from "@screen/ScreenFreeze";
import ScreenMotion from "@screen/ScreenMotion";
import useScreenStore from "@screen/store";

import useScreen from "@screen/useScreen";

function ScreenLayout({
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

export default ScreenLayout;
