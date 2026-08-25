import { createPartTransition } from "@flemo/react";

import "./crumb.types";

// The choreography for the strip beside the stack.
//
// A Part OUTSIDE a screen always carries `data-flemo-active="false"`, because
// there is no screen context to say otherwise — so the variants it plays are
// the "-false" half, and the pose it animates FROM on each flight is `idle`.
// That is what makes this shape work: idle is the pre-navigation pose, `enter`
// is where every navigation settles it, and the flight's first frame snaps back
// to idle before running, exactly like a part inside a screen.
//
// Kept to a few pixels and a little opacity. It is describing the thing that
// moved, not competing with it.
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
const SETTLED = { value: { opacity: 1, x: 0 }, options: { duration: 0.3, ease: EASE } };

const crumb = createPartTransition({
  name: "crumb",
  initial: { opacity: 0, x: -8 },
  idle: { value: { opacity: 0.75, x: -4 }, options: { duration: 0 } },
  enter: SETTLED,
  exit: SETTLED
});

export default crumb;
