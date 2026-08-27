"use client";

import { createTransition } from "@flemo/react";

import "./aperture.types";

// Written for the container transform, because the container transform will not
// take just any partner:
//
//   zoom.ts
//     "PAIR IT WITH A STILL SCREEN TRANSITION. The camera supersedes that
//      screen's own transform for the flight (see `carry`), so `none` or an
//      opacity-only transition composes; a slide is replaced rather than
//      combined."
//
// So this animates NO transform on either side. Every other authored entry on
// this bench moves a screen (`reveal` settles the covered one back, `drift`
// and `fade-through` scale), and every one of those would have its move thrown
// away by the camera rather than added to it.
//
// THE DURATION IS THE POINT of authoring it rather than reaching for `layout`.
// A morph writes no duration of its own:
//
//   shared.ts
//     "a morph is not a transition of its own, it happens INSIDE one, so the
//      runtime falls back to the length of whichever screen transition is
//      flying"
//
// `zoom` authors none either, so the camera runs for exactly as long as this
// does. `layout`'s 0.4s is sized for one element crossing a still screen; a
// camera pushing a whole screen past the edges is a much larger move over the
// same distance in time, and it needs longer to read as travel instead of as a
// jump. 0.5s is the top of Material's own container-transform band.
//
// The fade is front-loaded harder than `layout`'s so the destination is solid
// early and the rest of the flight belongs to the camera.
//
// NO SWIPE, deliberately. A swipe drags a screen directly, and during this
// flight the screen is not the consumer's to drag: the camera owns its
// transform.
const DURATION = 0.5;
const FADE: [number, number, number, number] = [0.15, 0.95, 0.25, 1];

const aperture = createTransition({
  name: "aperture",
  initial: { opacity: 0 },
  idle: {
    value: { opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { opacity: 1 },
    options: { duration: DURATION, ease: FADE }
  },
  enterBack: {
    value: { opacity: 0 },
    options: { duration: DURATION, ease: FADE }
  },
  // The covered screen holds. It is the one carrying the camera, and touching
  // its opacity would fade the very thing the zoom is pushing past the edges.
  exit: {
    value: { opacity: 1 },
    options: { duration: DURATION }
  },
  exitBack: {
    value: { opacity: 1 },
    options: { duration: DURATION }
  }
});

export default aperture;
