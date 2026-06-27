import { type ComponentPropsWithRef, type PropsWithChildren, useRef } from "react";

import type { BarTransitionName } from "@flemo/core";

import useScreen from "@screen/useScreen";

import useNavigateStore from "@stores/useNavigateStore";

export interface BarTransitionProps extends PropsWithChildren<ComponentPropsWithRef<"div">> {
  // The registered createBarTransition `name` to run on this element.
  name: BarTransitionName;
}

// Wraps a specific bar child and runs a named bar transition on it, driven by
// the screen's lifecycle. Programmatic transitions are driven by the compiled
// `@keyframes` the bar selector emits (compositor, no React re-render); the
// status / active the screen scope exposes are mirrored onto the wrapper so the
// right variant matches. Selective by design: only the wrapped child animates,
// the rest of the bar stays put.
function BarTransition({ ref, name, style, children, ...props }: BarTransitionProps) {
  const { isActive } = useScreen();

  const scopeRef = useRef<HTMLDivElement | null>(null);

  const status = useNavigateStore((state) => state.status);

  return (
    <div
      ref={(node) => {
        scopeRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      data-flemo-bar-transition-name={name}
      data-flemo-status={status}
      data-flemo-active={isActive ? "true" : "false"}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export default BarTransition;
