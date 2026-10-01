import { useContext } from "react";

import ScreenContext from "@screen/ScreenContext";

/**
 * The enclosing screen's identity and role in the current flight: `isActive`,
 * `isPrev`, `isRoot`, `zIndex`, `routePath`, and the resolved transition names.
 *
 * `isActive` follows the STACK, not travel direction, so on a pop the screen
 * being dismissed is still the active one. Outside a `Screen` the fields are
 * empty rather than absent, which is how chrome beside a `Slot` reads it safely.
 */
export default function useScreen() {
  return useContext(ScreenContext);
}
