// THE STACKING CONTRACT INSIDE ONE SCREEN.
//
// A screen container is a stacking context of its own (`isolation: isolate`),
// so everything below is ordered against its siblings and against nothing
// else. Screens themselves are ordered by their stack position on the
// container; this table is about what a single screen puts INSIDE that box.
//
//   content   the scope: the element that moves, and everything the consumer
//             wrote in the screen
//   chrome    the shared top/bottom bars, which are rendered beside the scope
//             so they can be handed between two screens
//   overlay   a <Layer>'s host slot — content that had to leave the scope
//             because a moving screen is a containing block and a stacking
//             context for its descendants, and an overlay that must cover the
//             chrome cannot be one of them
//   decorator the dim, which is the last thing a screen paints over itself
//
// Every one of these was previously `z-index: auto` and ordered by document
// position alone. That worked, and it was unwritable: it could not be stated,
// asserted, or read by a consumer deciding what number their own content
// needs. Worse, it made the ordering an accident of JSX order — moving one
// element in the tree silently reordered paint. The numbers below say the same
// thing the tree used to say, out loud.
//
// The decorator sits ABOVE the overlay deliberately. A screen going behind
// another one dims; if the dim stopped below the overlay, a covered screen
// would darken while its own sheet stayed bright.

/** The scope, and the consumer content inside it. Left implicit at `auto`. */
export const CONTENT_LEVEL = "auto";

/** Shared top and bottom bars, over the screen's content. */
export const CHROME_LEVEL = 1;

/** A `<Layer>` host slot, over the chrome it exists to cover. */
export const OVERLAY_LEVEL = 2;

/** The dim, over everything the screen owns — its overlay included. */
export const DECORATOR_LEVEL = 3;

/**
 * The order as one readable list, so a test can assert the relation rather
 * than restate the numbers and drift from them.
 */
export const SCREEN_STACKING_ORDER = [
  { role: "chrome", level: CHROME_LEVEL },
  { role: "overlay", level: OVERLAY_LEVEL },
  { role: "decorator", level: DECORATOR_LEVEL }
] as const;
