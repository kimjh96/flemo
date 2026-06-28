import { createContext, useContext } from "react";

export interface ScreenViewportContextValue {
  // When true, a screen's viewport-level chrome (the screen container, the
  // status / system-navigation bars, the shared bars, and the swipe-edge bars)
  // anchors to its enclosing region via `position: absolute` instead of the
  // browser viewport via `position: fixed`. A root <Router> leaves this false,
  // so screens fill the viewport exactly as before. A nested <Router> (a
  // transition region inside a persistent layout) flips it so its screens
  // transition inside that region rather than across the whole viewport.
  contained: boolean;
}

const ScreenViewportContext = createContext<ScreenViewportContextValue>({ contained: false });

export function useScreenViewport() {
  return useContext(ScreenViewportContext);
}

export default ScreenViewportContext;
