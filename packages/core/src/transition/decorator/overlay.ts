import createDecorator from "@transition/decorator/createDecorator";

// `backgroundColor` is held at the target dim across every variant so only
// `opacity` actually animates. Effective dim is `opacity × 0.3`, which gives
// a linear perceived ramp instead of the non-linear `opacity × bg_alpha`
// product the previous setup produced (0.5 × 0.15 ≈ 0.075 at midpoint vs
// 0.5 × 0.3 = 0.15 now). It also keeps the keyframe single-property:
// `opacity` is compositor-friendly on every browser, while animating
// `background-color` on a transformed ancestor has historically tripped
// color-space interpolation quirks in iOS Safari.
const DIM_COLOR = "rgba(0, 0, 0, 0.3)";

const overlay = createDecorator({
  name: "overlay",
  initial: {
    opacity: 0,
    backgroundColor: DIM_COLOR
  },
  idle: {
    value: {
      opacity: 0,
      backgroundColor: DIM_COLOR
    },
    options: {
      duration: 0
    }
  },
  // Visible dim — applied when this screen is the one going behind / sitting
  // behind a new active screen (PUSHING-false / REPLACING-false / COMPLETED-false).
  // Duration matches cupertino's enter so the dim resolves in lockstep with the
  // underlying screen slide (and there's no animation-vs-hold-by-fill window for
  // the rest-rule handoff to race against — that's a function of duration + fill,
  // not the curve). Easing is intentionally left at the default: this animates
  // `opacity` (a luminance channel), not position, so cupertino's positional
  // decelerate curve would front-load the darkening into an abrupt step with a
  // long invisible tail. The default ease spreads the perceived dim evenly across
  // the duration, matching this decorator's linear-perceived-ramp design (see the
  // DIM_COLOR note above).
  enter: {
    value: {
      opacity: 1,
      backgroundColor: DIM_COLOR
    },
    options: {
      duration: 0.7
    }
  },
  // POPPING-false target: the previously-behind screen is returning to active.
  // Fades from `enter` (visible dim) back to invisible so the overlay clears
  // before the screen lands at COMPLETED-true (= idle). Mirrors cupertino's
  // enterBack (the returning screen's slide-in) duration.
  exit: {
    value: {
      opacity: 0,
      backgroundColor: DIM_COLOR
    },
    options: {
      duration: 0.6
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
