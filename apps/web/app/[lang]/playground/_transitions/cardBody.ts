"use client";

import { createPartTransition } from "@flemo/react";

import "./cardBody.types";

// What the card's own contents do while the card is a box in flight.
//
// They have to do something, because of how a morph grows:
//
//   morphKeyframes.ts
//     "A box, not a scale ... animating the box lets the subtree lay itself out
//      at every size on the way"
//
// The subtree laying itself out at every size is right for the artwork and for
// type that is paired. It is wrong for everything else in this card: a buy
// control at cell width is a squeezed pill that unfurls, and a page of copy at
// cell width is a column of two-word lines that reflows the whole way. Both were
// visible on a recording, described as the button clenching before it opens.
//
// So the unpaired contents are not drawn while the box is travelling. The card
// crosses as a surface, and its contents arrive once the surface has room for
// them. That is the container transform as Material describes it, and it is
// what the deleted playground did with its own parts.
//
// The departing copy rides `dismiss`, which is the POPPING-true slot: the
// screen being dismissed, and the ACTIVE one, because `data-flemo-active`
// follows the stack rather than the direction. Before that slot existed the
// collapsed factory pinned it to `idle`, so the copy sat at full opacity while
// the box shrank under it, and this file had to restate all ten variants
// through createRawPartTransition to move one of them. The deleted playground
// hit the same wall and recorded the same remedy: "authored with
// createRawPartTransition so the dismissing screen's copy leaves on its own
// short clock".
//
// The clock is `aperture`'s, which is the only transition that carries this
// case, so there is no table to keep in step: arrive in the last half of the
// flight, leave in the first fifth of it.
const IN = 0.24;
const IN_DELAY = 0.26;
const OUT = 0.12;
const EASE_IN: [number, number, number, number] = [0, 0, 0.2, 1];
const EASE_OUT: [number, number, number, number] = [0.4, 0, 1, 1];

const SHOWN = { opacity: 1 };
const HIDDEN = { opacity: 0 };
const REST = { value: SHOWN, options: { duration: 0 } };

const cardBody = createPartTransition({
  name: "card-body",
  initial: HIDDEN,
  // The arriving detail. Held back until the card has most of its size, then
  // brought up over the rest of the flight. The clock rides on `idle` because
  // that is the pose PUSHING-true and REPLACING-true animate TO; the rest rules
  // sharing the slot are poses only and ignore the timing.
  idle: {
    value: SHOWN,
    options: { duration: IN, delay: IN_DELAY, ease: EASE_IN }
  },
  // The grid going behind. Its cells are not parts, so this only has to be a
  // resting value.
  enter: REST,
  // The grid coming back.
  exit: REST,
  // THE DISMISSING DETAIL. Gone in the first fifth, so the box shrinks empty
  // rather than dragging a page of copy down into a cell.
  dismiss: {
    value: HIDDEN,
    options: { duration: OUT, ease: EASE_OUT }
  }
});

export default cardBody;
