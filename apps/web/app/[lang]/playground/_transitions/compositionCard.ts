import { createMorphTransition, createPartTransition } from "@flemo/react";

import "./compositionCard.types";

const ARRIVE = [0.4, 0, 1, 1] as const;
const LEAVE = [0, 0, 0.2, 1] as const;

// THE COPY HANDS OVER ON THE SCREEN'S OWN CLOCK, because it is beside the
// shared box rather than inside it (see CompositionStoryCard). Nothing carries
// it, so nothing stretches it and nothing prints one sentence over the other:
// the departing sentence leaves while the arriving one comes in, over the
// transition, the way any pair of screen fields does. The 0.13s cut this used to
// run was the price of keeping unshared copy in the box, and the card read as
// switched off and then travelling empty for the rest of the transition.
const compositionCardCopy = createPartTransition({
  name: "composition-card-copy",
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { ease: ARRIVE } },
  enter: { value: { opacity: 0 }, options: { ease: LEAVE } },
  exit: { value: { opacity: 1 }, options: { ease: ARRIVE } },
  dismiss: { value: { opacity: 0 }, options: { ease: LEAVE } }
});

// THE BOX AND ITS TITLE ARE THE IDENTITY, AND THEY DISSOLVE LIKE ONE.
//
// Both ends now render the same children inside the box: one panel and one
// line of type. That is what `shared`'s long dissolve is for, so the ghost is
// given the preset's own length instead of the short cut the unshared copy
// needed.
export const compositionCardShell = createMorphTransition({
  name: "composition-card-shell",
  initial: {},
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: { value: { opacity: 1 }, options: {} },
  exit: { value: { opacity: 0 }, options: {} },
  options: { radius: true }
});

const compositionCardParts = [compositionCardCopy];

export default compositionCardParts;
