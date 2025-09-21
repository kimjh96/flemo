import { AnimatePresence } from "motion/react";

import useHistoryStore from "@history/store";
import useNavigationStore from "@navigate/store";
import ScreenFreeze from "@screen/ScreenFreeze";
import ScreenMotion from "@screen/ScreenMotion";
import useScreenStore from "@screen/store";

import useScreen from "@screen/useScreen";

import type { ScreenProps } from "@screen/Screen";

function LayoutScreen({ children, ...props }: ScreenProps) {
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
