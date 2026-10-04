import { createPartTransition } from "@flemo/react";

import "./miniBar.types";

// The shared bar's title and action. They ride the cupertino transition, so every
// variant uses cupertino's curve: a Part that should sit at the same fraction
// of its path as the screen, under a finger as well as on a timed pop, needs the
// screen's easing. Durations are left out on purpose: each variant inherits the
// carrying screen's clock for the same key.
const TRANSITION_EASE = [0.32, 0.72, 0, 1] as const;

const miniBarTitle = createPartTransition({
  name: "mini-bar-title",
  initial: { opacity: 0, x: 56 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: TRANSITION_EASE } },
  enter: { value: { opacity: 0, x: -56 }, options: { ease: TRANSITION_EASE } },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: TRANSITION_EASE } },
  dismiss: { value: { opacity: 0, x: 56 }, options: { ease: TRANSITION_EASE } }
});

const miniBarAction = createPartTransition({
  name: "mini-bar-action",
  initial: { opacity: 0, x: 10 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: TRANSITION_EASE } },
  enter: { value: { opacity: 0, x: -10 }, options: { ease: TRANSITION_EASE } },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: TRANSITION_EASE } },
  dismiss: { value: { opacity: 0, x: 10 }, options: { ease: TRANSITION_EASE } }
});

const miniBarParts = [miniBarTitle, miniBarAction];

export default miniBarParts;
