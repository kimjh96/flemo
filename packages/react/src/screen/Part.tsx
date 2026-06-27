import { type ComponentPropsWithRef, type PropsWithChildren } from "react";

import type { PartTransitionName } from "@flemo/core";

import useScreen from "@screen/useScreen";

import useNavigateStore from "@stores/useNavigateStore";

export interface PartProps extends PropsWithChildren<ComponentPropsWithRef<"div">> {
  // The registered createPartTransition `name` to run on this element.
  name: PartTransitionName;
}

// Wraps a specific element and runs a named part-transition on it, driven by
// the screen's lifecycle. Programmatic transitions are driven by the compiled
// `@keyframes` the bar selector emits (compositor, no React re-render); the
// status / active the screen scope exposes are mirrored onto the wrapper so the
// right variant matches. Selective by design: only the wrapped child animates,
// the rest of the bar stays put.
function Part({ ref, name, style, children, ...props }: PartProps) {
  const { isActive } = useScreen();

  const status = useNavigateStore((state) => state.status);

  return (
    <div
      ref={ref}
      data-flemo-part-name={name}
      data-flemo-status={status}
      data-flemo-active={isActive ? "true" : "false"}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export default Part;
