import { createTransition } from "@flemo/react";

import "./sheet.types";

// A CONSUMER-authored transition, here to answer one question: what happens
// when the shared element becomes the whole screen?
//
// Nothing special, is the answer. The two systems are separate and compose:
// the morph carries the element, and the SCREEN transition carries everything
// behind it. So this one animates only the screen being covered — it recedes
// and blurs — while the arriving screen animates nothing at all, because the
// element expanding over it is the entire event.
//
// They stay in step for free: a morph with no duration of its own inherits the
// flying screen's, and both are paused by the same hold until the same frame
// releases them.
const DURATION = 0.4;
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

const sheet = createTransition({
  name: "sheet",
  initial: { opacity: 0 },
  idle: {
    value: { scale: 1, filter: "blur(0px)" },
    options: { duration: 0 }
  },
  // The arriving screen is transparent and holds nothing but its chrome — the
  // element opening over it is the event — so all it does is bring that chrome
  // in. It still has to ANIMATE something: a variant with no motion at all
  // gives the engine no clock to end the flight on, and the whole screen then
  // lands in one late commit, which is a flicker of its own making.
  enter: {
    value: { opacity: 1 },
    options: { duration: DURATION, ease: EASE }
  },
  enterBack: {
    value: { opacity: 0 },
    options: { duration: DURATION, ease: EASE }
  },
  // The background follows the MORPH'S direction: the element is opening out
  // to fill the screen, so what is behind it pushes out too — scaling up and
  // blurring, the way a lens racks focus past it. (Scaling it down instead
  // reads as the background retreating, which is a different gesture and the
  // opposite of what the element is doing.)
  exit: {
    value: { scale: 1.08, filter: "blur(10px)" },
    options: { duration: DURATION, ease: EASE }
  },
  exitBack: {
    value: { scale: 1, filter: "blur(0px)" },
    options: { duration: DURATION, ease: EASE }
  }
});

export default sheet;
