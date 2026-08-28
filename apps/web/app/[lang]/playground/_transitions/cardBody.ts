"use client";

import { createRawPartTransition } from "@flemo/react";

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
// RAW, because the collapsed factory cannot express the dismissing side. In
// `createPartTransition` the POPPING-true slot (the screen being dismissed,
// which is the ACTIVE one: `data-flemo-active` follows the stack, not the
// direction) is pinned to `idle`, so the copy would sit at full opacity while
// the box shrank under it. The deleted playground hit this and recorded the
// same remedy: "authored with createRawPartTransition so the dismissing
// screen's copy leaves on its own short clock".
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

const cardBody = createRawPartTransition({
  name: "card-body",
  initial: HIDDEN,
  idle: REST,
  // The arriving detail. Held back until the card has most of its size, then
  // brought up over the rest of the flight.
  pushOnEnter: {
    value: SHOWN,
    options: { duration: IN, delay: IN_DELAY, ease: EASE_IN }
  },
  // The grid going behind. Its cells are not parts, so this only has to be a
  // resting value.
  pushOnExit: REST,
  replaceOnEnter: {
    value: SHOWN,
    options: { duration: IN, delay: IN_DELAY, ease: EASE_IN }
  },
  replaceOnExit: REST,
  // THE DISMISSING DETAIL. Gone in the first fifth, so the box shrinks empty
  // rather than dragging a page of copy down into a cell.
  popOnEnter: {
    value: HIDDEN,
    options: { duration: OUT, ease: EASE_OUT }
  },
  // The grid coming back.
  popOnExit: REST,
  completedOnEnter: REST,
  completedOnExit: REST
});

export default cardBody;
