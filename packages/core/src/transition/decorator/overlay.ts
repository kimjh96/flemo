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

// NO DURATIONS, on purpose. Every variant below runs on the clock of whichever
// transition names this decorator (resolveDecoratorClock), so the dim resolves
// in lockstep with the screen slide underneath it and there is no
// animation-vs-hold-by-fill window for the rest-rule handoff to race against.
// That is a function of duration and fill, not of the curve.
//
// They used to be written out as 0.7s, copied from cupertino's own DURATION
// because cupertino is what names this decorator. That copy is what `layout`
// could not use: at 0.4s it left a wash lifting off a screen that had stopped
// moving 300ms earlier, so `layout` shipped with no dim at all.
//
// EASING stays unwritten, and that is a separate decision from the timing: this
// animates `opacity`, a luminance channel, not position, so cupertino's
// positional decelerate curve would front-load the darkening into an abrupt
// step with a long invisible tail. The default ease spreads the perceived dim
// evenly across whatever duration it inherits, matching this decorator's
// linear-perceived-ramp design (see the DIM_COLOR note above). A curve is not
// inherited and never will be.
const overlay = createDecorator({
  name: "overlay",
  initial: {
    opacity: 0,
    backgroundColor: DIM_COLOR
  },
  // Not visible, and nothing to animate: every channel here already holds the
  // value `initial` gives it, so this variant compiles to a rest rule whatever
  // clock it inherits.
  idle: {
    value: {
      opacity: 0,
      backgroundColor: DIM_COLOR
    }
  },
  // Visible dim: applied when this screen is the one going behind / sitting
  // behind a new active screen (PUSHING-false / REPLACING-false /
  // COMPLETED-false), on the span the screen underneath takes to retreat.
  enter: {
    value: {
      opacity: 1,
      backgroundColor: DIM_COLOR
    }
  },
  // POPPING-false target: the previously-behind screen is returning to active.
  // Fades from `enter` (visible dim) back to invisible so the overlay clears
  // before the screen lands at COMPLETED-true (= idle), on the span of the
  // returning screen's slide-in.
  exit: {
    value: {
      opacity: 0,
      backgroundColor: DIM_COLOR
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
