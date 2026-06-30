import useHistoryStore from "@stores/useHistoryStore";

// The current pathname, read reactively from the navigation's destination entry.
// A public accessor for chrome rendered outside a <Screen> (a header, a sidebar)
// that needs the active route without reaching into the stores. Uses
// `pendingIndex` so a pop reports its destination immediately (consistent with
// push), instead of lagging until the back transition finishes.
export default function usePathname(): string {
  return useHistoryStore((state) => state.histories[state.pendingIndex]?.pathname ?? "/");
}
