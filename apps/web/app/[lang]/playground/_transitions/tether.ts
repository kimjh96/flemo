"use client";

import { createTransition, DEFAULT_COMMIT_FRACTION, DEFAULT_COMMIT_VELOCITY } from "@flemo/react";

import "./tether.types";

const DURATION = 0.5;
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const PARALLAX = 30;

// How far the drag has gone when the fade is spent. The screen is still only
// a third of the way out at that point, and keeps sliding for the rest.
const FADED_AT = 0.35;
const FADED_TO = 0.35;

// How much of the drag the tethered chrome takes. Less than all of it, so it
// trails the screen it sits on rather than riding it.
const TRAIL = 0.55;

// WHAT A CONSUMER'S OWN SWIPE LOOKS LIKE, which is the one thing the presets
// cannot show: all four of them declare a drag that is their pop walked by the
// finger, and nothing here would ever exercise the two surfaces a consumer
// reaches for first.
//
// TWO RATES IN ONE SCREEN. The drag spends this screen's opacity by a third of
// the way across and then keeps sliding it out for the remaining two thirds.
// One destination cannot say that, because one progress walks one keyframe, so
// the stop at that third is named and the keyframe carries three poses.
//
// AND SOMETHING CARRIED BY HAND. The floating header is dragged at a fraction
// of the finger so it trails, which is a per-frame value and therefore a hook.
// Naming where the screens go keeps them on the scrub anyway, so the hook here
// drives one small element while flemo keeps two full-screen layers on the
// compositor. Writing the hook WITHOUT a destination is what used to hand the
// screens over with it.
const tether = createTransition({
  name: "tether",
  initial: { x: "100%" },
  idle: {
    value: { x: 0, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { x: 0, opacity: 1 },
    options: { duration: DURATION, ease: EASE }
  },
  enterBack: {
    value: { x: "100%", opacity: 1 },
    options: { duration: DURATION, ease: EASE }
  },
  exit: {
    value: { x: `-${PARALLAX}%` },
    options: { duration: DURATION, ease: EASE }
  },
  exitBack: {
    value: { x: 0 },
    options: { duration: DURATION, ease: EASE }
  },
  options: {
    decoratorName: "overlay",
    swipe: {
      direction: "x",
      // The drag is not this transition's pop: the pop slides at a steady
      // opacity, and the drag spends the opacity early.
      current: [
        { at: FADED_AT, value: { x: `${FADED_AT * 100}%`, opacity: FADED_TO } },
        { value: { x: "100%", opacity: FADED_TO } }
      ],
      prev: { x: 0 },
      onMove: (_event, info, { animate, currentScreen }) => {
        const header = currentScreen.querySelector<HTMLElement>("header");
        if (header) {
          animate(header, { x: Math.max(0, info.offset.x) * -(1 - TRAIL) }, { duration: 0 });
        }
        return 0;
      },
      onEnd: async (_event, info, { animate, currentScreen }) => {
        const header = currentScreen.querySelector<HTMLElement>("header");
        if (header) await animate(header, { x: 0 }, { duration: DURATION, ease: EASE });
        // AND THEN THE VERDICT, which this transition has no opinion about.
        //
        // Taking over `onEnd` to land one element of your own means answering
        // the commit question as well, so the shared rule is restated here
        // from the constants flemo applies when nobody takes it over. It is a
        // wart: a hook that only wants to land something should be able to
        // leave the answer alone.
        const span = currentScreen.getBoundingClientRect().width || window.innerWidth;
        return (
          info.offset.x >= span * DEFAULT_COMMIT_FRACTION ||
          info.velocity.x > DEFAULT_COMMIT_VELOCITY
        );
      }
    }
  }
});

export default tether;
