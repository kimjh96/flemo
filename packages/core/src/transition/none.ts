import createTransition from "@transition/createTransition";

/**
 * The cut, registered as `"none"`: every variant at zero duration, nothing
 * animated.
 *
 * It is also the fallback an unregistered transition name resolves to, which is
 * why a misspelled name reads as a screen that simply appears. Author it
 * deliberately when a `Morph` owns the whole navigation, as `zoom` requires.
 */
const none = createTransition({
  name: "none",
  initial: {},
  idle: {
    value: {},
    options: {
      duration: 0
    }
  },
  enter: {
    value: {},
    options: {
      duration: 0
    }
  },
  enterBack: {
    value: {},
    options: {
      duration: 0
    }
  },
  exit: {
    value: {},
    options: {
      duration: 0
    }
  },
  exitBack: {
    value: {},
    options: {
      duration: 0
    }
  }
});

export default none;
