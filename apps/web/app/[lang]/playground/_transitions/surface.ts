"use client";

import { createMorphTransition } from "@flemo/react";

import "./surface.types";

// The card's own morph: the box that becomes the page.
//
// IT CARRIES THE CAMERA, and it has to be this one rather than the artwork
// inside it. Asking the nested artwork to carry instead was measured on the
// running build: zero camera animations for the whole flight. A morph that
// rides its container cannot move the screen the container is on.
//
// It carries a ghost too, unlike the artwork. The two ends of this box show
// genuinely different things (a cell's caption against a page), so the copy is
// what covers the hand-over instead of doubling a picture.
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

const surface = createMorphTransition({
  name: "surface",
  initial: {},
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: { value: { opacity: 1 }, options: { ease: EASE } },
  exit: { value: { opacity: 0 }, options: { ease: EASE } },
  options: { crossFade: 0.55, radius: true, carry: "screen" }
});

export default surface;
