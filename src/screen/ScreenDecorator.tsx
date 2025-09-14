import { type ComponentPropsWithRef, useEffect, useImperativeHandle } from "react";

import { motion, useAnimate } from "motion/react";

import useNavigationStore from "@navigate/store";

import useScreen from "@screen/useScreen";

import { decoratorMap } from "@transition/decorator/decorator";
import { transitionMap } from "@transition/transition";

function ScreenDecorator({ children, ref, ...props }: ComponentPropsWithRef<"div">) {
  const { isActive, transitionName } = useScreen();

  const [scope, animate] = useAnimate();

  useImperativeHandle(ref, () => scope.current!);

  const status = useNavigationStore((state) => state.status);

  const currentTransition = transitionMap.get(transitionName)!;
  const { decoratorName } = currentTransition;
  const { initial, variants } = decoratorMap.get(decoratorName!)!;

  useEffect(() => {
    if (!scope.current) return;

    const { value, options } = variants[`${status}-${isActive}`];

    animate(scope.current, value, options);
  }, [status, isActive, animate, variants, scope]);

  return (
    <motion.div
      ref={scope}
      initial={initial}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        ...props.style
      }}
      data-decorator
    />
  );
}

export default ScreenDecorator;
