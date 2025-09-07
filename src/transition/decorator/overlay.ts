import { animate } from "motion";

import createDecorator from "@transition/decorator/createDecorator";

const overlay = createDecorator({
  name: "overlay",
  initial: {
    opacity: 0,
    backgroundColor: "rgba(0, 0, 0, 0)"
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
    onSwipeStart: (triggered, { prevDecorator }) =>
      animate(
        prevDecorator,
        {
          opacity: triggered ? 1 : 0
        },
        {
          duration: 0.3
        }
      ),
    onSwipe: (_, progress, { prevDecorator }) =>
      animate(
        prevDecorator,
        {
          opacity: Math.max(0, 1 - progress / 100)
        },
        {
          duration: 0
        }
      ),
    onSwipeEnd: (triggered, { prevDecorator }) =>
      animate(
        prevDecorator,
        {
          opacity: triggered ? 0 : 1
        },
        {
          duration: 0.3
        }
      )
  }
});

export default overlay;
