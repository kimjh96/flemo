import type { PropsWithChildren } from "react";

import { MotionConfig } from "motion/react";

import useNavigationStore from "@navigate/store";
import useScreen from "@screen/useScreen";
import { transitionMap } from "@transition/transition";

import type { MotionConfigProps } from "motion/react";

function LayoutConfig({ children, ...props }: PropsWithChildren<MotionConfigProps>) {
  const { isActive, transitionName } = useScreen();
  const status = useNavigationStore((state) => state.status);
  const currentTransition = transitionMap.get(transitionName);

  return (
    <MotionConfig
      transition={currentTransition?.variants[`${status}-${isActive}`]?.options}
      {...props}
    >
      {children}
    </MotionConfig>
  );
}

export default LayoutConfig;
