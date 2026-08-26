import { type ComponentPropsWithRef, useImperativeHandle, useRef } from "react";

import { decoratorMap, resolveTransition } from "@flemo/core";

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
        // No z-index: the decorator is positioned and rendered after the
        // scope, so tree order already paints it over the screen's content.
        // A number here would only matter for beating consumer content that
        // carries one of its own — and that is what put the covered screen's
        // dim over the INCOMING screen once the container stopped being a
        // stacking context.
        ...style
      }}
      {...props}
    />
  );
}

export default ScreenDecorator;
