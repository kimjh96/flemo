import { createMorphTransition, createPartTransition } from "@flemo/react";

import "./compositionCard.types";

const ARRIVE = [0.4, 0, 1, 1] as const;
const LEAVE = [0, 0, 0.2, 1] as const;

// The copy hand-over is SHORT and it is the same length on both sides: the
// ghost dissolves over `crossFade` of the flight while the arriving Part fades
// in after it, so the two must agree or the card's copy goes nearly transparent
// in the middle of its own hand-over. 0.13s of a 0.7s flight is over before the
// box has stretched the ghost enough to read.
const COPY = 0.13;

const compositionCardCopy = createPartTransition({
  name: "composition-card-copy",
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { ease: ARRIVE, duration: COPY, delay: COPY } },
  enter: { value: { opacity: 0 }, options: { ease: LEAVE, duration: COPY } },
  exit: { value: { opacity: 1 }, options: { ease: ARRIVE, duration: COPY, delay: COPY } },
  dismiss: { value: { opacity: 0 }, options: { ease: LEAVE, duration: COPY } }
});

// THE CARD'S COPY IS NOT SHARED, SO ITS HAND-OVER IS SHORT.
//
// `shared` dissolves a ghost of the departing card over 55% of the flight,
// which is right when both ends show the same thing at two sizes. This card
// does not: the eyebrow reads "Today" against "Message 42" and the subtitle is
// a different sentence at each end. The engine holds a departing `Part` at its
// own size inside the ghost, so the copy stays crisp for as long as it paints;
// what no engine can decide is how long two DIFFERENT sentences may overlap.
// Long enough to read both is a double exposure, so the dissolve is SHORT and
// the arriving copy waits exactly that long before fading in. One number,
// `COPY`, is both halves, because a hand-over whose two sides disagree leaves
// the card's copy nearly transparent in the middle of itself.
export const compositionCardShell = createMorphTransition({
  name: "composition-card-shell",
  initial: {},
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: { value: { opacity: 1 }, options: {} },
  exit: { value: { opacity: 0 }, options: {} },
  options: { crossFade: 0.19, radius: true }
});

const compositionCardParts = [compositionCardCopy];

export default compositionCardParts;
