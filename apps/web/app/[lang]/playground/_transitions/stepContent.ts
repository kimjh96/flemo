import { createRawPartTransition } from "@flemo/react";

import "./stepContent.types";

// The same job as `detail-content`, for a screen with NO shared element on it.
//
// `detail-content` leaves in 0.22s against an arrival of 0.4s, and that
// asymmetry is deliberate there: the eye is already following an element out
// of the screen, so the copy should go with it rather than after it. Take the
// element away and the asymmetry is all that is left. Measured on the chain's
// fade step: the push ran ~480ms of visible motion (a 0.32s screen fade plus
// the copy arriving on its delayed 0.4s clock) and the pop ran ~200ms, so the
// same navigation in reverse read as a different, blunter transition.
//
// So this one mirrors: no entry delay, and a leave that is the arrival's
// length rather than half of it.
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
const REST = { opacity: 1, y: 0 };
const HELD = { value: REST, options: { duration: 0 } };
const ARRIVE = { value: REST, options: { duration: 0.32, ease: EASE } };
const LEAVE = { value: { opacity: 0, y: 8 }, options: { duration: 0.3, ease: EASE } };

const stepContent = createRawPartTransition({
  name: "step-content",
  initial: { opacity: 0, y: 10 },
  idle: HELD,
  pushOnEnter: ARRIVE,
  pushOnExit: HELD,
  replaceOnEnter: ARRIVE,
  replaceOnExit: HELD,
  // The dismissing screen's copy, on the same clock it arrived with.
  popOnEnter: LEAVE,
  popOnExit: HELD,
  completedOnEnter: HELD,
  completedOnExit: HELD
});

export default stepContent;
