import type { PropsWithChildren } from "react";

import { MotionConfig, type MotionConfigProps } from "motion/react";

import { transitionMap } from "@flemo/core";

import { useNavigateStore, useScreen } from "@flemo/react";

function LayoutConfig({ children, ...props }: PropsWithChildren<MotionConfigProps>) {
  const { isActive, transitionName } = useScreen();
  const status = useNavigateStore((state) => state.status);
  const currentTransition = transitionMap.get(transitionName);

  // Our local AnimationOptions (in @flemo/core) is structurally a superset of
  // motion's Transition for the fields motion's layout engine actually reads
  // (duration, ease as cubic-bezier or named string). Motion's nominal type
  // diverged after the split — cast to bridge.
  const options = currentTransition?.variants[`${status}-${isActive}`]?.options;

  // motion's layout animations only honor `transition.layout` — if we set
  // only the top-level transition, layout animations silently fall back to
  // motion's default spring (which has overshoot, causing morphing text and
  // containers to briefly swell). Mirror the same options into `layout` so
  // motion's layout engine runs on flemo's timing instead.
  const transition = options
    ? ({ ...options, layout: options } as MotionConfigProps["transition"])
    : (options as MotionConfigProps["transition"]);

  return (
    <MotionConfig transition={transition} {...props}>
      {children}
    </MotionConfig>
  );
}

export default LayoutConfig;
