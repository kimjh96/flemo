import createTransition from "@transition/createTransition";

const linear = (value: number, from: [number, number], to: [number, number]) => {
  const [fromMin, fromMax] = from;
  const [toMin, toMax] = to;
  if (fromMax === fromMin) return toMin;
  const t = (value - fromMin) / (fromMax - fromMin);
  return toMin + t * (toMax - toMin);
};

// The native iOS navigation push/pop, per the measured consensus of its
// closest replications (Ionic's ios.transition: 540ms,
// cubic-bezier(0.32, 0.72, 0, 1), -33% parallax; react-navigation's
// forHorizontalIOS: -30% parallax, 0.3 leading-edge shadow; UIKit itself
// runs a critically-damped spring settling ≈ 500-550ms with a 0.3 parallax
// factor — Liquid Glass (iOS 26) restyled materials, not these kinematics):
// - DURATION/EASE: UIKit's spring settles ~500-550ms (Ionic replicates it
//   at 540ms) on this bezier; flemo runs the same curve over 0.7s — an
//   authored choice for a calmer glide, not a platform measurement. One
//   clock for every participant.
// - PARALLAX: the covered screen retreats 30% of its width.
// The dim over the covered screen lives in the `overlay` decorator. The
// native leading-edge shadow is deliberately NOT replicated.
const PARALLAX = 30;
const DURATION = 0.7;

// How far a drag has to travel, as a fraction of the screen it is dragging,
// before the release commits. 0.128 is the 50px this named for years measured
// against the 390px phone it was dialed on, so the felt threshold is unchanged
// where it was chosen and scales with the screen everywhere else.
const COMMIT_FRACTION = 50 / 390;

// The distance THIS SCREEN travels, which is the basis for both the drag's
// progress and its commit threshold. A screen fills its Router, and a Router
// does not always fill the window: a nested one lives in whatever box its host
// gives it. `window.innerWidth` is the fallback for a screen with no layout
// yet, not the reference.
// No SSR guard on `window` here, and it is not an omission: this is reached
// only from the swipe handlers, which run from a pointer event, so a window
// exists by definition. The controller's own span keeps one because it is
// computed on a path a server render can reach.
const screenSpan = (screen: HTMLElement): number =>
  screen.getBoundingClientRect().width || window.innerWidth;
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

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
      duration: DURATION,
      ease: EASE
    }
  },
  enterBack: {
    value: {
      x: "100%"
    },
    options: {
      duration: DURATION,
      ease: EASE
    }
  },
  exit: {
    value: {
      x: `-${PARALLAX}%`
    },
    options: {
      duration: DURATION,
      ease: EASE
    }
  },
  exitBack: {
    value: {
      x: 0
    },
    options: {
      duration: DURATION,
      ease: EASE
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
      // Against the SCREEN's box, not the window's. This screen travels its own
      // width, so that is the distance a drag is a fraction of; the two are the
      // same question only for a Router that fills the viewport. Measured in a
      // 348px stage inside a 1275px window: a 158px drag read as 12% travelled
      // while the screen had covered 45%, so the covered screen barely
      // parallaxed for the whole gesture and the dim barely lifted.
      const progress = linear(dragX, [0, screenSpan(currentScreen)], [0, 100]);

      onProgress?.(true);

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
          x: `${-PARALLAX + progress * (PARALLAX / 100)}%`
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
      // The commit threshold shares the progress mapping's reference, because
      // a gesture that measures its travel one way and decides on it another
      // has two ideas of how far along it is. COMMIT_FRACTION is the 50px this
      // used to name, expressed against the 390px screen it was chosen on, so
      // a phone commits exactly where it always did and a wider screen asks
      // for proportionally more rather than the same 50px.
      const isTriggered = dragX > screenSpan(currentScreen) * COMMIT_FRACTION || velocity.x > 20;

      onStart?.(isTriggered);

      await Promise.all([
        animate(
          currentScreen,
          {
            x: isTriggered ? "100%" : 0
          },
          {
            // This transition's own span is the release's CEILING: the swipe
            // controller shortens it to what is left and how fast the finger
            // was going (see swipeSettleSeconds), so a swipe-completed pop
            // lands like the same pop driven by a button instead of on a
            // clock of its own.
            duration: DURATION,
            ease: EASE
          }
        ),
        animate(
          prevScreen,
          {
            x: isTriggered ? 0 : `-${PARALLAX}%`
          },
          {
            // This transition's own span is the release's CEILING: the swipe
            // controller shortens it to what is left and how fast the finger
            // was going (see swipeSettleSeconds), so a swipe-completed pop
            // lands like the same pop driven by a button instead of on a
            // clock of its own.
            duration: DURATION,
            ease: EASE
          }
        )
      ]);

      return isTriggered;
    }
  }
});

export default cupertino;
