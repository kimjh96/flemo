import { createRawPartTransition } from "@flemo/react";

import { CLOCKS, barPartFor, type Clock } from "./clocks";

import "./barContent.types";

// The factory's return type rather than a named import: `PartTransition` is
// internal to the packages, and a playground is not the place to widen a
// package's public surface for its own convenience.
type AuthoredPart = ReturnType<typeof createRawPartTransition>;

// THE SHARED BAR'S CONTENTS, one part transition per screen transition.
//
// The bar's BOX is shared: flemo keeps it out of the flight and it holds its
// place while the screens travel underneath. What moves INSIDE it is the
// screen's, and it has to move on the screen's clock — see `clocks.ts` for why
// that cannot be a constant, and why it cannot even be one constant per preset.
//
// So this is a factory, not a definition. `bar-cupertino` runs 0.7s on
// cupertino's own bezier both ways; `bar-material` runs 0.35s on a push and
// 0.25s on a pop, because material does. The bar asks for the one belonging to
// the transition it is sitting above, and the two can no longer disagree.
//
// The RAW factory, not `createPartTransition`, for the reason the collapsed
// model cannot express: it hands `POPPING-true` — the screen being dismissed —
// the same REST variant as an arrival, which is correct for a bar that leaves
// with its screen and wrong for one that stays while its contents hand over.
// The dismissing side needs its own pose, going back out the way it came in.
const REST = { opacity: 1, x: 0 };

// How far a label travels, at a bar's own scale rather than the screen's. A
// label carrying a full screen-width would be a second screen transition
// stacked on the first; 56px reads as "with the screen" without competing with
// it. What matters for a desync is the CLOCK, not the distance — the two are
// authored separately for that reason.
//
// A transition that does not translate its screens gets zero, because a label
// sliding over a screen that only fades is inventing a direction the flight
// does not have.
const TRAVEL = 56;

const build = (name: string, clock: Clock): AuthoredPart => {
  const travel = clock.slides ? TRAVEL : 0;
  // A rest state is not a motion. A zero clock costs the navigation nothing,
  // which matters because the engine spans a screen's choreography even when
  // the screen transition itself has none.
  const held = { value: REST, options: { duration: 0 } };
  const push = (value: Record<string, number>) => ({ value, options: { ...clock.push } });
  const pop = (value: Record<string, number>) => ({ value, options: { ...clock.pop } });

  return createRawPartTransition({
    name: barPartFor(name),
    initial: { opacity: 0, x: travel },
    idle: held,
    // Arriving: in from the side the screen is coming from.
    pushOnEnter: push(REST),
    // Going behind: out the way the screen is going.
    pushOnExit: push({ opacity: 0, x: -travel }),
    replaceOnEnter: push(REST),
    replaceOnExit: push({ opacity: 0, x: -travel }),
    // The screen on top, being dismissed: back out the way it came in, on the
    // POP clock, because that is what its screen is running.
    popOnEnter: pop({ opacity: 0, x: travel }),
    // The screen underneath, returning: from `pushOnExit`'s pose back to rest.
    popOnExit: pop(REST),
    completedOnEnter: held,
    completedOnExit: { value: { opacity: 0, x: -travel }, options: { duration: 0 } }
  });
};

// One per row of the clock table, so a transition can never be selected
// without its bar part existing.
export const BAR_PARTS: AuthoredPart[] = Object.entries(CLOCKS).map(([name, clock]) =>
  build(name, clock)
);

export default BAR_PARTS;
