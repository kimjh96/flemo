import { type ComponentPropsWithRef, useImperativeHandle, useRef } from "react";

import { DECORATOR_LEVEL, decoratorMap, resolveTransition } from "@flemo/core";

import useScreen from "@screen/useScreen";

import useNavigateStore from "@stores/useNavigateStore";

function ScreenDecorator({ ref, style, ...props }: ComponentPropsWithRef<"div">) {
  const { isActive, isPrev, transitionName } = useScreen();

  const scopeRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => scopeRef.current!);

  // A RESTING deep screen's decorator pins its status subscription to a
  // constant (see Part / ScreenMotion): without the pin every navigation
  // flipped every stacked screen's decorator overlay through
  // PUSHING→COMPLETED — an O(depth) attribute-write storm that also
  // re-triggered their compiled decorator keyframes.
  const status = useNavigateStore((state) => (isPrev ? "COMPLETED" : state.status));

  const currentTransition = resolveTransition(transitionName);
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
        // The top of the screen's own stack (see SCREEN_STACKING_ORDER). Tree
        // order alone used to say this, and it stopped being enough once a
        // <Layer> host joined the container: the dim has to reach a screen's
        // OVERLAY too, or a covered screen darkens while its own sheet stays
        // bright. The number cannot leak past the container either way —
        // ScreenMotion's `isolation: isolate` bounds it.
        zIndex: DECORATOR_LEVEL,
        ...style
      }}
      {...props}
    />
  );
}

export default ScreenDecorator;
