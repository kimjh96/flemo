import { createRawPartTransition } from "@flemo/react";

import "./barContent.types";

// The bar's CONTENTS, which is the half of a shared bar that has to move.
//
// A shared bar is kept out of the screen transition on purpose: it holds its
// place while the screens travel under it. What that leaves is the thing this
// exists to fix. Traced during a pop, before it existed and again with the
// collapsed factory:
//
//   returning screen's bar content   0.00 -> 1.00   (fading in, correctly)
//   dismissing screen's bar content  1.00 -> 1.00   (never leaves)
//
// The dismissing bar sits ABOVE the returning one, so a label fading in
// underneath an opaque label that never fades out is invisible: what reaches
// the eye is the screen you are leaving, named in the bar, for the whole way
// back, and then a swap at the end. Which is exactly what it looked like.
//
// `createPartTransition` cannot express the fix, because it hands `POPPING-true`
// the rest variant — right for a bar that LEAVES with its screen, wrong for one
// that stays behind while the contents hand over. The raw factory gives that
// status its own pose, so the outgoing label goes out the way its screen is
// going and the incoming one arrives from the other side, in the same box.
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const DURATION = 0.32;
const REST = { opacity: 1, x: 0 };
const HELD = { value: REST, options: { duration: 0 } };
const ARRIVE = { value: REST, options: { duration: DURATION, ease: EASE } };
// Going behind: out toward the trailing edge, and GONE rather than dimmed,
// because the other screen's label is arriving into the same box.
const BEHIND = { value: { opacity: 0, x: -12 }, options: { duration: DURATION, ease: EASE } };
// Being dismissed: out the way the screen is going, which is the other way.
const DISMISSED = { value: { opacity: 0, x: 12 }, options: { duration: DURATION, ease: EASE } };

const barContent = createRawPartTransition({
  name: "bar-content",
  initial: { opacity: 0, x: 12 },
  idle: HELD,
  pushOnEnter: ARRIVE,
  pushOnExit: BEHIND,
  replaceOnEnter: ARRIVE,
  replaceOnExit: BEHIND,
  // The screen on top, leaving.
  popOnEnter: DISMISSED,
  // The screen underneath, coming back: from BEHIND's pose to rest.
  popOnExit: ARRIVE,
  completedOnEnter: HELD,
  // Settled behind: stay gone, so it is not waiting at full opacity for the
  // next flight to reveal it.
  completedOnExit: { value: { opacity: 0, x: -12 }, options: { duration: 0 } }
});

export default barContent;
