import { transform } from "motion/react";

import createTransition from "@transition/createTransition";

const layout = createTransition({
  name: "layout",
  initial: {
    opacity: 0.97
  },
  idle: {
    value: {
      opacity: 1
    },
    options: {
      duration: 0.3
    }
  },
  enter: {
    value: {
      opacity: 1
    },
    options: {
      duration: 0.3
    }
  },
  enterBack: {
    value: {
      opacity: 0.97
    },
    options: {
      duration: 0.3
    }
  },
  exit: {
    value: {
      opacity: 0.97
    },
    options: {
      duration: 0.3
    }
  },
  exitBack: {
    value: {
      opacity: 1
    },
    options: {
      duration: 0.3
    }
  },
  options: {
    decoratorName: "overlay",
    swipeDirection: "y",
    onSwipeStart: async () => {
      return true;
    },
    onSwipe: (_, info, { animate, currentScreen, onProgress }) => {
      const { offset } = info;
      const dragY = offset.y;
      const clamped = Math.max(0, Math.min(56, dragY));
      const opacity = transform(clamped, [0, 56], [1, 0.96]);
      const extra = Math.max(0, dragY - 56);
      const extraRatio = Math.min(1, extra / 160);
      const resistedExtra = Math.sqrt(extraRatio) * 12;
      const finalY = Math.max(0, clamped + resistedExtra);
      const progress = Math.min(56, finalY);

      onProgress?.(true, 100);

      animate(
        currentScreen,
        {
          y: finalY,
          opacity
        },
        {
          duration: 0
        }
      );

      return progress;
    },
    onSwipeEnd: async (_, info, { animate, currentScreen, prevScreen, onStart }) => {
      const { offset, velocity } = info;
      const dragY = offset.y;
      const isTriggered = dragY > 56 || velocity.y > 20;

      onStart?.(isTriggered);

      await Promise.all([
        animate(
          currentScreen,
          {
            y: isTriggered ? "100%" : 0,
            opacity: isTriggered ? 0.96 : 1
          },
          {
            duration: 0.3
          }
        ),
        animate(
          prevScreen,
          {
            y: 0,
            opacity: isTriggered ? 1 : 0.97
          },
          {
            duration: 0.3
          }
        )
      ]);

      return isTriggered;
    }
  }
});

export default layout;
