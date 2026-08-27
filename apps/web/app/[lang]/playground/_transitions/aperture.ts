"use client";

import { createTransition } from "@flemo/react";

import "./aperture.types";

// Written for the container transform, and mostly it gets out of the way.
//
// The camera will not take just any partner:
//
//   zoom.ts
//     "PAIR IT WITH A STILL SCREEN TRANSITION. The camera supersedes that
//      screen's own transform for the flight (see `carry`), so `none` or an
//      opacity-only transition composes; a slide is replaced rather than
//      combined."
//
// So it animates NO transform on either side. Every other authored entry on
// this bench moves a screen, and every one of those would have its move thrown
// away by the camera rather than added to it.
//
// IT DOES FADE THE ARRIVAL IN, and an attempt to stop it is recorded here so it
// is not tried again. The reasoning was that this screen is made of one card,
// the card is a morph, and a morph is staged in the FLIGHT LAYER, so holding the
// screen clear for the flight would keep the grid visible under a card that is
// drawn regardless. It does not: with `enter` held at zero until the last
// frame, the stage renders EMPTY for the whole flight. Measured on the running
// build, the card sits in the layer at opacity 1 and paints nothing, so the
// layer is subject to its screen after all. The fade stays.
//
// THE DURATION IS WHY THIS IS A TRANSITION AT ALL rather than `none`. A morph
// writes no duration of its own:
//
//   shared.ts
//     "a morph is not a transition of its own, it happens INSIDE one, so the
//      runtime falls back to the length of whichever screen transition is
//      flying"
//
// `zoom` authors none either, so the camera, the card and the type inside it
// all run for exactly as long as this does. `none` would give them zero.
// `layout`'s 0.4s is sized for one element crossing a still screen; a camera
// pushing a whole screen past the edges is a much larger move over the same
// distance in time. 0.5s is the top of Material's own container-transform band.
//
// NO SWIPE, deliberately. A swipe drags a screen directly, and during this
// flight the screen is not the consumer's to drag: the camera owns its
// transform.
const DURATION = 0.5;
// Front-loaded, so the arrival is solid early and the rest of the flight
// belongs to the camera and the card.
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
