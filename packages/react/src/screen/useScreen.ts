import { useContext } from "react";

import ScreenContext from "@screen/ScreenContext";

/**
 * The enclosing screen's identity and role in the current transition: `isActive`,
 * `isPrev`, `isRoot`, `zIndex`, `routePath`, and the resolved transition names.
 *
 * `isActive` follows the STACK, not travel direction, so on a pop the screen
 * that is closing is still the active one. Outside a `Screen` the fields are
 * empty rather than absent, which is how a header or other fixed UI beside a
 * `Slot` reads it safely.
 */
export default function useScreen() {
  return useContext(ScreenContext);
}
