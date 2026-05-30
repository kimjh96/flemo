import createTransition from "@transition/createTransition";

const linear = (value: number, from: [number, number], to: [number, number]) => {
  const [fromMin, fromMax] = from;
  const [toMin, toMax] = to;
  if (fromMax === fromMin) return toMin;
  const t = (value - fromMin) / (fromMax - fromMin);
  return toMin + t * (toMax - toMin);
};

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
      duration: 0.7,
      ease: [0.32, 0.72, 0, 1]
    }
  },
  enterBack: {
    value: {
      x: "100%"
    },
    options: {
      duration: 0.6,
      ease: [0.32, 0.72, 0, 1]
    }
  },
  exit: {
    value: {
      x: "-30%"
    },
    options: {
      duration: 0.7,
      ease: [0.32, 0.72, 0, 1]
    }
  },
  exitBack: {
    value: {
      x: 0
    },
    options: {
      duration: 0.6,
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
      const progress = linear(dragX, [0, window.innerWidth], [0, 100]);

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
          x: `${-30 + progress * 0.3}%`
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
            x: isTriggered ? 0 : "-30%"
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
