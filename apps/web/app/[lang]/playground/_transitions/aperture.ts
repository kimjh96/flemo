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
// IT DOES NOT FADE THE ARRIVAL AT ALL, and getting here took two wrong turns
// that are recorded so they are not taken again.
//
// A front-loaded fade was the first. It covered the grid in about 50ms, so the
// camera pushed a screen nobody could see any more and the stage read as going
// black around a small card. That is the whole case defeated by its own
// partner.
//
// Holding the screen at zero for the flight was the second, on the reasoning
// that the card is a morph staged in the FLIGHT LAYER and therefore drawn
// regardless. It is not: measured, the card sits in the layer at opacity 1 and
// paints nothing while its screen is transparent, so the layer is subject to
// its screen.
//
// What works is neither. The screen does not fade, and it does not paint: the
// detail hands its background to the CARD when a card is carrying it, so this
// screen contributes nothing of its own and the grid stays visible around a
// card that is opaque from its first frame.
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

const aperture = createTransition({
  name: "aperture",
  initial: { opacity: 1 },
  idle: {
    value: { opacity: 1 },
    options: { duration: 0 }
  },
  // Nothing changes. The duration is here so the morph, the camera and the part
  // inside the card all resolve to it.
  enter: {
    value: { opacity: 1 },
    options: { duration: DURATION }
  },
  enterBack: {
    value: { opacity: 1 },
    options: { duration: DURATION }
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
