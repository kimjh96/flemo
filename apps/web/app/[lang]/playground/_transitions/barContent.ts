import { createRawPartTransition } from "@flemo/react";

import "./barContent.types";

// THE APP BAR'S CONTENTS, in two flavours, because one is not enough.
//
// The bar's BOX is shared: flemo keeps it out of the screen transition and it
// holds its place. What moves inside it has to match what the screens are
// doing, and the screens are not all doing the same thing:
//
//   a screen that SLIDES (cupertino, material)   the label has to travel with
//                                                it, or the content moves a
//                                                screen-width while the title
//                                                twitches 12px and the two
//                                                read as unrelated
//   a screen that FADES  (layout, fade)          nothing translates, so a
//                                                label that slides is inventing
//                                                a direction the flight has not
//
// Traced on a cupertino pop with only the small cross-fade: the screens carried
// a full width while the titles moved twelve pixels. That is the "따로 논다".
//
// So two named transitions, and the bar picks the one that belongs to the
// screen transition it is sitting above. Both are the same shape otherwise: out
// the way the screen is going, in from the other side, and the dismissing side
// gets its own pose because a shared bar's contents hand over while the box
// stays (see the POPPING-true note below).
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const DURATION = 0.34;
const REST = { opacity: 1, x: 0 };
const HELD = { value: REST, options: { duration: 0 } };

const build = (name: "bar-slide" | "bar-fade", travel: number) =>
  createRawPartTransition({
    name,
    initial: { opacity: 0, x: travel },
    idle: HELD,
    pushOnEnter: { value: REST, options: { duration: DURATION, ease: EASE } },
    // Going behind: out the way the screen is going.
    pushOnExit: { value: { opacity: 0, x: -travel }, options: { duration: DURATION, ease: EASE } },
    replaceOnEnter: { value: REST, options: { duration: DURATION, ease: EASE } },
    replaceOnExit: {
      value: { opacity: 0, x: -travel },
      options: { duration: DURATION, ease: EASE }
    },
    // The screen on top, being dismissed: out the other way. `createPartTransition`
    // hands this status the REST variant, which is right for a bar that leaves
    // with its screen and wrong for one that stays while its contents hand over.
    popOnEnter: { value: { opacity: 0, x: travel }, options: { duration: DURATION, ease: EASE } },
    // The screen underneath, returning: from `pushOnExit`'s pose back to rest.
    popOnExit: { value: REST, options: { duration: DURATION, ease: EASE } },
    completedOnEnter: HELD,
    completedOnExit: { value: { opacity: 0, x: -travel }, options: { duration: 0 } }
  });

// A slide's worth of travel, and a fade's worth: 56px reads as "with the
// screen" at a bar's scale without becoming a second animation of its own.
export const barSlide = build("bar-slide", 56);
export const barFade = build("bar-fade", 0);

export default barSlide;
