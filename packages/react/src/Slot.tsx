import { type CSSProperties, type PropsWithChildren } from "react";

import Renderer from "@renderer/Renderer";

import ScreenViewportContext from "@screen/ScreenViewportContext";

export interface SlotProps {
  /** Sizes the region box the screens are contained to. */
  className?: string;
  /** Sizes the region box the screens are contained to. */
  style?: CSSProperties;
}

// Stable context value so the screens don't re-render on identity churn.
const CONTAINED_VIEWPORT = { contained: true };

/**
 * Marks WHERE the screen stack renders inside a layout.
 *
 * Put the `Route` declarations in a `Slot` and lay the rest of the page
 * (sidebar, header, footer) around it: only this region transitions between
 * routes, and everything outside it persists across every navigation. Chrome
 * that is literally identical on every route belongs out here rather than in a
 * `Part`.
 *
 * It stays one Router, one history, and one `useNavigate`, so a sidebar
 * navigates this region directly with no cross-boundary wiring. Screens are
 * contained to the region box (`position: absolute`), which the consumer sizes
 * through `className` or `style`.
 */
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
