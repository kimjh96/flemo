import createTransition from "@transition/createTransition";

const material = createTransition({
  name: "material",
  initial: {
    y: "100%"
  },
  idle: {
    value: {
      y: 0
    },
    options: {
      duration: 0
    }
  },
  enter: {
    value: {
      y: 0
    },
    options: {
      duration: 0.24,
      ease: [0.0, 0.0, 0.2, 1]
    }
  },
  enterBack: {
    value: {
      y: "100%"
    },
    options: {
      duration: 0.22,
      ease: [0.4, 0.0, 1, 1]
    }
  },
  exit: {
    value: {
      y: -56
    },
    options: {
      duration: 0.22,
      ease: [0.4, 0.0, 1, 1]
    }
  },
  exitBack: {
    value: {
      y: 0
    },
    options: {
      duration: 0.24,
      ease: [0.0, 0.0, 0.2, 1]
    }
  },
  options: {
    swipeDirection: "y",
    onSwipeStart: async () => {
      return true;
    },
    onSwipe: (_, info, { animate, currentScreen, prevScreen, onProgress }) => {
      const { offset } = info;
      const dragY = offset.y;
      const clamped = Math.max(0, Math.min(56, dragY));
      const extra = Math.max(0, dragY - 56);
      const extraRatio = Math.min(1, extra / 160);
      const resistedExtra = Math.sqrt(extraRatio) * 12;
      const finalY = Math.max(0, clamped + resistedExtra);
      const progress = Math.min(56, finalY);

      onProgress?.(true, progress);

      animate(
        currentScreen,
        {
          y: finalY
        },
        {
          duration: 0
        }
      );
      animate(
        prevScreen,
        {
          y: -56 + progress
        },
        { duration: 0 }
      );

      return progress;
    },
    onSwipeEnd: async (
      _,
      info,
      { animate, currentScreen, prevScreen, onStart }
    ): Promise<boolean> => {
      const { offset, velocity } = info;
      const dragY = offset.y;
      const isTriggered = dragY > 56 || velocity.y > 20;

      onStart?.(isTriggered);

      await Promise.all([
        animate(
          currentScreen,
          {
            y: isTriggered ? "100%" : 0
          },
          {
            duration: isTriggered ? 0.22 : 0.24,
            ease: isTriggered ? [0.4, 0.0, 1, 1] : [0.0, 0.0, 0.2, 1]
          }
        ),
        animate(
          prevScreen,
          {
            y: isTriggered ? 0 : -56
          },
          {
            duration: isTriggered ? 0.22 : 0.24,
            ease: isTriggered ? [0.0, 0.0, 0.2, 1] : [0.4, 0.0, 1, 1]
          }
        )
      ]);

      return isTriggered;
    }
  }
});

export default material;
