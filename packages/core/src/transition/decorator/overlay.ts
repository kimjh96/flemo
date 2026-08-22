import createDecorator from "@transition/decorator/createDecorator";

// `backgroundColor` is held at the target dim across every variant so only
// `opacity` actually animates. Effective dim is `opacity × 0.1` — the native
// iOS dim over the covered screen (react-navigation's forHorizontalIOS
// measures 0.07, Ionic's ios.transition uses 0.1; UIKit's own
// _UIParallaxDimmingView sits in that band). The linear ramp keeps the
// perceived dim even across the flight, and the keyframe stays
// single-property: `opacity` is compositor-friendly on every browser, while
// animating `background-color` on a transformed ancestor has historically
// tripped color-space interpolation quirks in iOS Safari.
const DIM_COLOR = "rgba(0, 0, 0, 0.1)";

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
  // Visible dim: applied when this screen is the one going behind / sitting
  // behind a new active screen (PUSHING-false / REPLACING-false / COMPLETED-false).
  // Duration matches cupertino's enter so the dim resolves in lockstep with the
  // underlying screen slide (and there's no animation-vs-hold-by-fill window for
  // the rest-rule handoff to race against. That's a function of duration + fill,
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
      duration: 0.7
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
    onSwipeEnd: (triggered, { animate, prevDecorator, settleSeconds }) =>
      animate(
        prevDecorator,
        {
          opacity: triggered ? 0 : 1
        },
        {
          // The screens' own release length when the transition reports one
          // (cupertino derives it from what is left and how fast the finger
          // was going); the historical fixed clock otherwise.
          duration: settleSeconds ?? 0.3
        }
      )
  }
});

export default overlay;
