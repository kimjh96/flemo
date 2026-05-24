import type { PropsWithChildren } from "react";

import { MotionConfig, type MotionConfigProps } from "motion/react";

import { transitionMap, useNavigateStore } from "@flemo/core";

import useScreen from "@screen/useScreen";

function LayoutConfig({ children, ...props }: PropsWithChildren<MotionConfigProps>) {
  const { isActive, transitionName } = useScreen();
  const status = useNavigateStore((state) => state.status);
  const currentTransition = transitionMap.get(transitionName);

  // Our local AnimationOptions (in @flemo/core) is structurally a superset of
  // Motion's Transition for the fields motion's layout engine actually reads
  // (duration, ease as cubic-bezier or named string). Motion's nominal type
  // diverged after the split — cast to bridge.
  const options = currentTransition?.variants[`${status}-${isActive}`]?.options;

  return (
    <MotionConfig transition={options as MotionConfigProps["transition"]} {...props}>
      {children}
    </MotionConfig>
  );
}

export default LayoutConfig;
