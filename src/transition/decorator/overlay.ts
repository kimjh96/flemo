import { animate } from "motion";

import createDecorator from "@transition/decorator/createDecorator";

const overlay = createDecorator({
  name: "overlay",
  initial: {
    opacity: 0,
    backgroundColor: "rgba(0, 0, 0, 0)",
    transition: {
      duration: 0
    }
  },
  enter: {
    value: {
      opacity: 0,
      backgroundColor: "rgba(0, 0, 0, 0.3)"
    },
    options: {
      duration: 0.3
    }
  },
  exit: {
    value: {
      opacity: 1,
      backgroundColor: "rgba(0, 0, 0, 0.3)"
    },
    options: {
      duration: 0.3
    }
  },
  options: {
    onSwipe: (progress, { prevDecorator }) =>
      animate(
        prevDecorator,
        {
          opacity: Math.max(0, 1 - progress / 100)
        },
        {
          duration: 0
        }
      )
  }
});

export default overlay;
