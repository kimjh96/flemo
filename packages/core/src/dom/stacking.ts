// THE STACKING CONTRACT INSIDE ONE SCREEN.
//
// A screen container is a stacking context of its own (`isolation: isolate`),
// so everything below is ordered against its siblings and against nothing
// else. This table is about what a single screen puts INSIDE that box.
//
// Almost none of it carries a number, and that is deliberate. The scope is in
// flow; the shared bars and the dim are positioned siblings that come after it
// in the tree, so paint order already puts them over the screen's content
// without anyone bidding. Numbering them looks tidier and is a regression: a
// consumer's own positioned content, and flemo's own nested screen containers,
// live INSIDE the scope and leak their z-indexes into this same context, so
// raising the bars to 1 silently demotes everything that used to outrank them
// at `auto`. Measured in a consumer app: a bottom sheet that covered the tab
// bar on the previous release stopped covering it, because the nested screen
// container holding the sheet also sits at 1 and lost the tie on tree order.
//
// The one thing that does carry a number is the <Layer> host, because it has a
// real bid to win: it must outrank everything inside the scope it escaped —
// the nested screens included, whose containers number themselves by stack
// position and climb as the stack grows.

/** The scope, the bars and the dim: ordered by paint order, not by number. */
export const UNNUMBERED_LEVEL = "auto";

/**
 * The `<Layer>` host.
 *
 * Above any screen container this context can contain. A screen container is
 * its stack position plus one, so the ceiling is a stack depth — this clears a
 * depth no navigation stack reaches, and cannot leak past the container that
 * isolates it.
 */
export const OVERLAY_LEVEL = 100000;

/**
 * The order as one readable list, so a test asserts the relation rather than
 * restating the numbers and drifting from them.
 */
export const SCREEN_STACKING_ORDER = [
  { role: "content", level: UNNUMBERED_LEVEL },
  { role: "chrome", level: UNNUMBERED_LEVEL },
  { role: "decorator", level: UNNUMBERED_LEVEL },
  { role: "overlay", level: OVERLAY_LEVEL }
] as const;
