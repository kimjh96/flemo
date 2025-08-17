import createTransition from "@transition/createTransition";

const none = createTransition({
  name: "none",
  initial: {
    transition: {
      duration: 0
    }
  },
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
