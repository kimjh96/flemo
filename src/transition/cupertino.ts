import { transform } from "motion/react";

import createTransition from "@transition/createTransition";

const cupertino = createTransition({
  name: "cupertino",
  initial: {
    x: "100%"
  },
  idle: {
    value: {
      x: 0
    },
    options: {
      duration: 0
    }
  },
  enter: {
    value: {
      x: 0
    },
    options: {
      duration: 0.3,
      ease: [0.32, 0.72, 0, 1]
    }
  },
  enterBack: {
    value: {
      x: "100%"
    },
    options: {
      duration: 0.3,
      ease: [0.32, 0.72, 0, 1]
    }
  },
  exit: {
    value: {
      x: -100
    },
    options: {
      duration: 0.3,
      ease: [0.32, 0.72, 0, 1]
    }
  },
  exitBack: {
    value: {
      x: 0
    },
    options: {
      duration: 0.3,
      ease: [0.32, 0.72, 0, 1]
    }
  },
  options: {
    decoratorName: "overlay",
    swipeDirection: "x",
    onSwipeStart: async () => {
      return true;
    },
    onSwipe: (_, info, { animate, currentScreen, prevScreen, onProgress }) => {
      const { offset } = info;
      const dragX = offset.x;
      const progress = transform(dragX, [0, window.innerWidth], [0, 100]);

      onProgress?.(true, progress);

      animate(
        currentScreen,
        {
          x: Math.max(0, dragX)
        },
        {
          duration: 0
        }
      );
      animate(
        prevScreen,
        {
          x: -100 + progress
        },
        {
          duration: 0
        }
      );

      return progress;
    },
    onSwipeEnd: async (_, info, { animate, currentScreen, prevScreen, onStart }) => {
      const { offset, velocity } = info;
      const dragX = offset.x;
      const isTriggered = dragX > 50 || velocity.x > 20;

      onStart?.(isTriggered);

      await Promise.all([
        animate(
          currentScreen,
          {
            x: isTriggered ? "100%" : 0
          },
          {
            duration: 0.3,
            ease: [0.32, 0.72, 0, 1]
          }
        ),
        animate(
          prevScreen,
          {
            x: isTriggered ? 0 : -100
          },
          {
            duration: 0.3,
            ease: [0.32, 0.72, 0, 1]
          }
        )
      ]);

      return isTriggered;
    }
  }
});

export default cupertino;
