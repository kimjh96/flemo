import createDecorator from "@transition/decorator/createDecorator";

const overlay = createDecorator({
  name: "overlay",
  initial: {
    opacity: 0,
    backgroundColor: "rgba(0, 0, 0, 0)"
  },
  idle: {
    value: {
      opacity: 0,
      backgroundColor: "rgba(0, 0, 0, 0)"
    },
    options: {
      duration: 0
    }
  },
  // Visible dim — applied when this screen is the one going behind / sitting
  // behind a new active screen (PUSHING-false / REPLACING-false / COMPLETED-false).
  // Duration + easing track cupertino's enter/exit so the dim arrives in
  // lockstep with the underlying screen slide and there's no
  // animation-vs-hold-by-fill window for the rest-rule handoff to race against.
  enter: {
    value: {
      opacity: 1,
      backgroundColor: "rgba(0, 0, 0, 0.3)"
    },
    options: {
      duration: 0.7,
      ease: [0.32, 0.72, 0, 1]
    }
  },
  // POPPING-false target: the previously-behind screen is returning to active.
  // Fades from `enter` (visible dim) back to invisible so the overlay clears
  // before the screen lands at COMPLETED-true (= idle). Mirrors cupertino's
  // enterBack (the returning screen's slide-in) duration.
  exit: {
    value: {
      opacity: 0,
      backgroundColor: "rgba(0, 0, 0, 0)"
    },
    options: {
      duration: 0.6,
      ease: [0.32, 0.72, 0, 1]
    }
  },
  options: {
    onSwipeStart: (triggered, { animate, prevDecorator }) =>
      animate(
        prevDecorator,
        {
          opacity: triggered ? 1 : 0
        },
        {
          duration: 0.3
        }
      ),
    onSwipe: (_, progress, { animate, prevDecorator }) =>
      animate(
        prevDecorator,
        {
          opacity: Math.max(0, 1 - progress / 100)
        },
        {
          duration: 0
        }
      ),
    onSwipeEnd: (triggered, { animate, prevDecorator }) =>
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
