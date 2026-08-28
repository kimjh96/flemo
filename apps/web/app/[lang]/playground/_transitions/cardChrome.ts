"use client";

import { createRawPartTransition } from "@flemo/react";

import "./cardChrome.types";

// The card's CHROME: the back control and the buy control.
//
// It cannot simply ride the card, and it cannot run the body's part either.
//
// Riding is what it did, and a recording shows why that fails. The chrome is a
// fixed size: the header's scrim is about 90px tall whatever the card is. At
// the start of a push the card is a grid cell, about 155px wide, so the chrome
// covers more than half of it and then dwindles to a thin strip as the card
// reaches full size. The card grows; the chrome does not; the proportion
// inverts on the way. That is the growth reading as unnatural.
//
// The body's part is wrong for it in the other direction: it leaves in the
// first fifth of a pop, which reads as the screen losing its header rather than
// the card leaving with it.
//
// So chrome arrives LATE and leaves LATE. It is absent while the card is small
// enough for it to dominate, and it is still there while the card is large
// enough to hold it.
const IN = 0.18;
const IN_DELAY = 0.3;
const OUT = 0.16;
const OUT_DELAY = 0.24;
const EASE_IN: [number, number, number, number] = [0, 0, 0.2, 1];
const EASE_OUT: [number, number, number, number] = [0.4, 0, 1, 1];

const SHOWN = { opacity: 1 };
const HIDDEN = { opacity: 0 };
const REST = { value: SHOWN, options: { duration: 0 } };

const cardChrome = createRawPartTransition({
  name: "card-chrome",
  initial: HIDDEN,
  idle: REST,
  pushOnEnter: {
    value: SHOWN,
    options: { duration: IN, delay: IN_DELAY, ease: EASE_IN }
  },
  pushOnExit: REST,
  replaceOnEnter: {
    value: SHOWN,
    options: { duration: IN, delay: IN_DELAY, ease: EASE_IN }
  },
  replaceOnExit: REST,
  // The dismissing detail. Held until the card has shrunk past the size where
  // the chrome would swamp it, then gone.
  popOnEnter: {
    value: HIDDEN,
    options: { duration: OUT, delay: OUT_DELAY, ease: EASE_OUT }
  },
  popOnExit: REST,
  completedOnEnter: REST,
  completedOnExit: REST
});

export default cardChrome;
