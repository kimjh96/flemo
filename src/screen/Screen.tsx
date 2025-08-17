import { type ComponentPropsWithRef } from "react";

import useNavigationStore from "@navigate/store";

import ScreenFreeze from "@screen/ScreenFreeze";
import ScreenMotion from "@screen/ScreenMotion";
import useScreenStore from "@screen/store";

import useScreen from "@screen/useScreen";

function Screen({ children, ...props }: ComponentPropsWithRef<"div">) {
  const { isActive, isPrev } = useScreen();

  const status = useNavigationStore((state) => state.status);
  const transitionStatus = useScreenStore((state) => state.transitionStatus);

  const isTransitionCompleted = status === "COMPLETED" && transitionStatus === "IDLE";
  const isFrozen = !isActive && (isTransitionCompleted || isPrev);

  return (
    <ScreenFreeze freeze={isFrozen}>
      <ScreenMotion {...props}>{children}</ScreenMotion>
    </ScreenFreeze>
  );
}

export default Screen;
