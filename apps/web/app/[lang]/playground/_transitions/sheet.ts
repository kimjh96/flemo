import { createTransition } from "@flemo/react";

import { CLOCKS } from "./clocks";

import "./sheet.types";

// A CONSUMER-authored transition, here to answer one question: what happens
// when the shared element becomes the whole screen?
//
// Nothing special, is the answer. The two systems are separate and they
// compose: the morph carries the element, and the SCREEN transition carries
// everything behind it. So this one animates only the screen being covered — it
// recedes and blurs — while the arriving screen animates nothing but its own
// opacity, because the element expanding over it is the entire event.
//
// They stay in step for free, and it is worth being precise about why, since it
// is the mechanism the rest of this folder has to imitate by hand: a morph that
// authors no duration resolves its length as the FLYING SCREEN'S duration
// (`attachMorph`: `enterMotion.options.duration ?? side.screenDuration`), and
// both are released by the same hold on the same frame. A <Part> gets no such
// inheritance, which is why its clock is generated from the same table this
// transition reads.
// Symmetric, so one beat serves both directions.
const { duration, ease } = CLOCKS.sheet!.push;

const sheet = createTransition({
  name: "sheet",
  initial: { opacity: 0 },
  idle: { value: { scale: 1, filter: "blur(0px)" }, options: { duration: 0 } },
  // The arriving screen is transparent and holds nothing but its chrome. It
  // still has to ANIMATE something: a variant with no motion at all gives the
  // engine no clock to end the flight on, and the whole screen then lands in
  // one late commit, which is a flicker of its own making.
  enter: { value: { opacity: 1 }, options: { duration, ease } },
  enterBack: { value: { opacity: 0 }, options: { duration, ease } },
  // The background follows the MORPH'S direction: the element is opening out to
  // fill the screen, so what is behind it pushes out too — scaling up and
  // blurring, the way a lens racks focus past it. (Scaling it down instead
  // reads as the background retreating, which is a different gesture and the
  // opposite of what the element is doing.)
  exit: { value: { scale: 1.08, filter: "blur(10px)" }, options: { duration, ease } },
  exitBack: { value: { scale: 1, filter: "blur(0px)" }, options: { duration, ease } }
});

export default sheet;
