"use client";

import { createTransition } from "@flemo/react";

import "./aperture.types";

// The screen transition the container-transform case runs on: the deleted
// playground's `sheet`, finally risen to its name. The arriving page comes up
// from the bottom edge while the covered screen pushes out and blurs, the way
// a lens racks focus past it.
//
// ONE DEFINITION, TWO SURFACES, and the difference is structural rather than
// branched. From the GRID the card is paired, so the arriving screen holds
// nothing but a hidden stand-in: a full-height slide of an empty screen paints
// nothing, and what shows is the camera pushing the grid out under the flying
// card. From the LIST the card has no partner, so the page itself is the
// arrival: it rises over the list, and the artwork glides into it on the
// screen's own curve, since a morph chasing a place on a moving screen adopts
// that screen's clock.
//
// No opacity anywhere, and that is a measured constraint, not a taste: the
// flight layer paints WITH the arriving screen, so a screen held or faded
// clear takes the flying card with it. The stage rendered empty for a whole
// flight the one time this was tried, and a front-loaded fade-in was tried
// too and covered the camera's work with an opaque sheet. Both are recorded
// so neither returns.
//
// The DURATION is why this exists rather than reusing a preset: a morph
// authors no duration, so the camera, the card and the type inside it all run
// exactly this long, and 0.5s is the top of Material's container-transform
// band.
const DURATION = 0.5;
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

const aperture = createTransition({
  name: "aperture",
  initial: { y: "100%" },
  idle: {
    value: { y: 0, scale: 1, filter: "blur(0px)" },
    options: { duration: 0 }
  },
  enter: {
    value: { y: 0 },
    options: { duration: DURATION, ease: EASE }
  },
  enterBack: {
    value: { y: "100%" },
    options: { duration: DURATION, ease: EASE }
  },
  // The background follows the MORPH'S direction: the element is opening out
  // to fill the screen, so what is behind it pushes out too. Scaling it down
  // instead reads as the background retreating, the opposite gesture.
  exit: {
    value: { scale: 1.08, filter: "blur(10px)" },
    options: { duration: DURATION, ease: EASE }
  },
  exitBack: {
    value: { scale: 1, filter: "blur(0px)" },
    options: { duration: DURATION, ease: EASE }
  }
});

export default aperture;
