import { type CSSProperties, type PropsWithChildren } from "react";

import Renderer from "@renderer/Renderer";

import ScreenViewportContext from "@screen/ScreenViewportContext";

export interface SlotProps {
  className?: string;
  style?: CSSProperties;
}

// Stable context value so the screens don't re-render on identity churn.
const CONTAINED_VIEWPORT = { contained: true };

// Marks WHERE the screen stack renders inside a layout. Put your <Route>s in a
// <Slot> and lay the rest of the screen (sidebar, header, footer) around it:
// only this region transitions between routes, everything outside it persists.
// One <Router>, one history, one navigate — a sidebar's `useNavigate` drives
// this region directly, no cross-boundary wiring. Screens are contained to the
// region box (position: absolute), which the consumer sizes via className/style.
function Slot({ children, className, style }: PropsWithChildren<SlotProps>) {
  return (
    <div className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
      <ScreenViewportContext.Provider value={CONTAINED_VIEWPORT}>
        <Renderer>{children}</Renderer>
      </ScreenViewportContext.Provider>
    </div>
  );
}

export default Slot;
