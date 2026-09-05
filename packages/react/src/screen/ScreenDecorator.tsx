import { type ComponentPropsWithRef, useImperativeHandle, useRef } from "react";

import { decoratorMap, resolveTransition } from "@flemo/core";

import useScreen from "@screen/useScreen";

import useNavigateStore from "@stores/useNavigateStore";

function ScreenDecorator({ ref, style, ...props }: ComponentPropsWithRef<"div">) {
  const { id, isActive, isPrev, transitionName } = useScreen();

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
      // Both copies of a screen's dim carry the same owner, so anything that
      // has to reach "this screen's decorator" reaches all of it (see
      // DECORATOR_OWNER_ATTR).
      data-flemo-decorator-owner={id}
      // The transition too, because a decorator's compiled rules belong to the
      // PAIR: its clock is this transition's, so the same decorator named by a
      // second transition of a different length compiles to a second rule set
      // that this element must not match. `currentTransition.name` rather than
      // the raw `transitionName` is the key the compiler used.
      data-flemo-transition={currentTransition.name}
      data-flemo-status={status}
      data-flemo-active={isActive ? "true" : "false"}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        // No z-index, the way there has never been one. The decorator is
        // positioned and rendered after the scope, so tree order already paints
        // it over the screen's content, and a number here would demote whatever
        // consumer content used to outrank it at `auto` — the same regression
        // numbering the bars produced. It therefore does NOT reach a <Layer>
        // overlay, which is above it by design; a screen dimming with its own
        // sheet still bright is a real question and an open one.
        ...style
      }}
      {...props}
    />
  );
}

export default ScreenDecorator;
