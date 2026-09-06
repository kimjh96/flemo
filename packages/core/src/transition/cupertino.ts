import createTransition from "@transition/createTransition";

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
    swipe: {
      // A DIRECTION IS THE WHOLE DECLARATION.
      //
      // This used to be sixty lines of hooks that between them said one thing:
      // walk this transition's own pop at the finger. The dragged screen
      // travels its own width and the covered one gives its parallax back, and
      // those are exactly `POPPING-true` and `POPPING-false` above — so the
      // controller stages them when the finger lands, moves them with the
      // gesture, and hands them back on release (see resolveSwipeOptions).
      //
      // Nothing about the motion changes. What changes is that the screens are
      // an ANIMATION for the whole gesture rather than a style write per frame,
      // which is what kept the release from having to commit one.
      //
      // No `threshold`: the shared default IS the 50px-on-390 this transition
      // used to carry. No `progress`: this drag follows the finger one for one
      // over the screen's own width, which is the geometric default.
      direction: "x"
    }
  }
});

export default cupertino;
