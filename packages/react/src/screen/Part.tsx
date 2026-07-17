import { type ComponentPropsWithRef, type PropsWithChildren } from "react";

import { useStore } from "zustand";

import type { PartTransitionName } from "@flemo/core";

import useScreen from "@screen/useScreen";

import useStores from "@stores/useStores";

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
  const { isActive, navigateStore } = useScreen();

  // The status must come from the Router that OWNS the enclosing screen. Inside
  // a nested <Router>'s chrome the nearest bundle is the inner Router's, so a
  // Part there would otherwise follow the wrong scope's transitions. The
  // nearest bundle stays as the fallback for a Part outside any screen.
  const stores = useStores();
  const status = useStore(navigateStore ?? stores.navigate, (state) => state.status);

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
