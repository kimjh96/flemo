import { useContext, type PropsWithChildren, type ReactNode } from "react";

import { createPortal } from "react-dom";

import LayerMountContext from "@screen/LayerMountContext";

// Lifts its children out of the screen's content-isolation box up to the scope
// level, so an overlay (bottom sheet, dim backdrop, FAB, toast) floats over the
// screen and rides its transition instead of being trapped — and re-parented
// mid-transition — inside the inset, scrollable content box.
//
// It's a building block: put it INSIDE a reusable overlay component (a
// BottomSheet, Dialog, …) once, and every consumer of that component gets the
// escape for free, with no wrapping at the call site. Outside a <Screen> (no
// mount node) it renders its children in place, so the component still works
// anywhere.
function Layer({ children }: PropsWithChildren): ReactNode {
  const mount = useContext(LayerMountContext);
  return mount ? createPortal(children, mount) : children;
}

export default Layer;
