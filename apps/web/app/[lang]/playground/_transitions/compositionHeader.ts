import { createPartTransition } from "@flemo/react";

import "./compositionHeader.types";

// Match the carrying cupertino screen's curve. A swipe maps every rider to
// spatial progress, while a programmatic pop plays each authored easing over
// time; a different Part curve would therefore put the title at a different
// point of its 72px path for the same screen position.
const FLIGHT_EASE = [0.32, 0.72, 0, 1] as const;

const headerTitle = createPartTransition({
  name: "composition-header-title",
  initial: { opacity: 0, x: 72 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: FLIGHT_EASE } },
  enter: {
    value: { opacity: 0, x: -72 },
    options: { ease: FLIGHT_EASE }
  },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: FLIGHT_EASE } },
  dismiss: {
    value: { opacity: 0, x: 72 },
    options: { ease: FLIGHT_EASE }
  }
});

const headerAction = createPartTransition({
  name: "composition-header-action",
  initial: { opacity: 0, x: 12 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: FLIGHT_EASE } },
  enter: {
    value: { opacity: 0, x: -12 },
    options: { ease: FLIGHT_EASE }
  },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: FLIGHT_EASE } },
  dismiss: {
    value: { opacity: 0, x: 12 },
    options: { ease: FLIGHT_EASE }
  }
});

const compositionHeaderParts = [headerTitle, headerAction];

export default compositionHeaderParts;
