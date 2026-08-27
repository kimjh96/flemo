"use client";

import { createMorphTransition } from "@flemo/react";

import "./plate.types";

// The artwork's own morph, and it carries NO GHOST.
//
// `shared` and `zoom` both dissolve a copy of the departing element over the
// arriving one, which is right when the two ends show different things and the
// hand-over needs covering. This element is a flat gradient at both ends: the
// copy is the same picture at a different size, so the dissolve is two versions
// of one square beating against each other while it grows. The option exists
// for exactly this:
//
//   typing.ts, on crossFade
//     "Set it to 0 to carry no copy, which cuts straight to the arrival's
//      content on the first frame."
//
// Cutting to the arrival on the first frame is invisible here, because the
// arrival is the same gradient.
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

const base = {
  initial: {},
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: { value: { opacity: 1 }, options: { ease: EASE } },
  exit: { value: { opacity: 0 }, options: { ease: EASE } }
} as const;

// No camera on it, in any case. Where the container transform needs one it
// comes from the card around this element: a morph riding its container cannot
// move the screen the container is on, which was measured as zero camera
// animations for a whole flight when this element was asked to carry.
const plate = createMorphTransition({
  name: "plate",
  ...base,
  options: { crossFade: 0, radius: true }
});

export default plate;
