import { type ComponentPropsWithRef, useImperativeHandle, useRef } from "react";

import useNavigationStore from "@navigate/store";

import useScreen from "@screen/useScreen";

import { transitionMap } from "@transition/transition";

import { decoratorMap } from "@transition/decorator/decorator";

function ScreenDecorator({ ref, style, ...props }: ComponentPropsWithRef<"div">) {
  const { isActive, transitionName } = useScreen();

  const scopeRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => scopeRef.current!);

  const status = useNavigationStore((state) => state.status);

  const currentTransition = (transitionMap.get(transitionName) ?? transitionMap.get("none"))!;
  const { decoratorName } = currentTransition;
  const decorator = decoratorMap.get(decoratorName!);

  if (!decorator) return null;

  return (
    <div
      ref={scopeRef}
      data-flemo-decorator
      data-flemo-decorator-name={decorator.name}
      data-flemo-status={status}
      data-flemo-active={isActive ? "true" : "false"}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
        ...style
      }}
      {...props}
    />
  );
}

export default ScreenDecorator;
