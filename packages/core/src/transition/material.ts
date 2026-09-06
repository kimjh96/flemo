import createTransition from "@transition/createTransition";

// How far the drag has actually pulled, for a finger that has gone `dragY`.
//
// It follows one for one up to PULL and then RESISTS: past that the screen
// keeps giving, but by a square root of how far past you are, so the gesture
// tells you it has run out without stopping dead.
const PULL = 56;
const RESIST_OVER = 160;
const RESIST_MAX = 12;

const pull = (dragY: number): number => {
  const followed = Math.max(0, Math.min(PULL, dragY));
  const over = Math.max(0, dragY - PULL);
  return followed + Math.sqrt(Math.min(1, over / RESIST_OVER)) * RESIST_MAX;
};

const material = createTransition({
  name: "material",
  initial: {
    y: "100%"
  },
  idle: {
    value: {
      y: 0,
      opacity: 1
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
      duration: 0.35,
      ease: [0.0, 0.0, 0.2, 1]
    }
  },
  enterBack: {
    value: {
      y: "100%"
    },
    options: {
      duration: 0.25,
      ease: [0.4, 0.0, 1, 1]
    }
  },
  exit: {
    value: {
      y: -56,
      opacity: 0
    },
    options: {
      duration: 0.35,
      ease: [0.4, 0.0, 1, 1]
    }
  },
  exitBack: {
    value: {
      y: 0,
      opacity: 1
    },
    options: {
      duration: 0.25,
      ease: [0.0, 0.0, 0.2, 1]
    }
  },
  options: {
    swipe: {
      direction: "y",
      // 56px, the pull this transition is built around: it is where the screen
      // arriving underneath has fully arrived, and so where letting go means
      // going rather than coming back.
      threshold: PULL,
      /**
       * THE RUBBER BAND LIVES HERE, and only here.
       *
       * The drag is the pop's own keyframes — `y: 0 → 100%` on the screen being
       * pushed away, `y: -56 → 0` with the opacity behind it on the one
       * arriving — so the SHAPE is declared above. What is not declared is the
       * RATE, and material's rate is not the finger's: the pull resists past
       * `PULL` with a square-root falloff instead of following on.
       *
       * TWO NUMBERS BECAUSE THE TWO SIDES DISAGREE, which is the case that put
       * the pair in the type. The screen leaving travels its own height, so it
       * keeps moving while the band stretches; the screen arriving travels
       * `PULL` and is home, so it stops there and waits. One number would have
       * to pick which of the two to be wrong about.
       */
      progress: (info, span) => {
        const pulled = pull(info.offset.y);
        return {
          active: span > 0 ? pulled / span : 0,
          passive: Math.min(PULL, pulled) / PULL
        };
      }
    }
  }
});

export default material;
