import useHistoryStore from "@stores/useHistoryStore";

// The current pathname, read reactively from the navigation's destination entry.
// A public accessor for chrome rendered outside a <Screen> (a header, a sidebar)
// that needs the active route without reaching into the stores. Uses
// `pendingIndex` so a pop reports its destination immediately (consistent with
// push), instead of lagging until the back transition finishes.
/**
 * The current pathname of the nearest Router, for chrome rendered OUTSIDE a
 * `Screen` that needs the active route.
 *
 * It reports the navigation's DESTINATION, so a pop reads the path it is
 * returning to from the first frame rather than lagging until the transition
 * finishes, matching what a push already did.
 */
export default function usePathname(): string {
  return useHistoryStore((state) => state.histories[state.pendingIndex]?.pathname ?? "/");
}
