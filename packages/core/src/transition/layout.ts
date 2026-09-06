import createTransition from "@transition/createTransition";

const linear = (value: number, from: [number, number], to: [number, number]) => {
  const [fromMin, fromMax] = from;
  const [toMin, toMax] = to;
  if (fromMax === fromMin) return toMin;
  const t = (value - fromMin) / (fromMax - fromMin);
  return toMin + t * (toMax - toMin);
};

// ONE screen moves at a time, and it is always the one arriving or leaving.
//
// Two earlier shapes were wrong on glass. `0.97 → 1` was not a fade at all:
// the arriving screen popped in whole and the dismissing one hard-cut. A true
// cross-fade (both sides animating) was worse — two opaque screens at half
// opacity double-expose, and the muddle reads as flicker exactly where a
// shared element is meant to be carrying the eye.
//
// So: on a push the arriving screen fades in OVER a stationary one; on a pop
// the dismissing screen fades out and the one underneath simply holds. The
// fade is front-loaded (it is nearly over by a third of the flight) so the
// window where anything shows through is short, while the shared element above
// keeps travelling for the whole duration.
// 0.4s, not the 0.3s it used to run. The screen's own fade is over in the first
// third of it either way (that is what the front-loaded curve is for); the rest
// belongs to the shared element travelling above, and 0.3s was not enough of it
// to read as travel.
const DURATION = 0.4;
const FADE: [number, number, number, number] = [0.2, 0.9, 0.3, 1];

const layout = createTransition({
  name: "layout",
  initial: {
    opacity: 0
  },
  idle: {
    value: {
      opacity: 1
    },
    options: {
      duration: DURATION
    }
  },
  enter: {
    value: {
      opacity: 1
    },
    options: {
      duration: DURATION,
      ease: FADE
    }
  },
  enterBack: {
    value: {
      opacity: 0
    },
    options: {
      duration: DURATION,
      ease: FADE
    }
  },
  exit: {
    value: {
      opacity: 1
    },
    options: {
      duration: DURATION
    }
  },
  exitBack: {
    value: {
      opacity: 1
    },
    options: {
      duration: DURATION
    }
  },
  options: {
    // NO DIM, and the reason is a taste one.
    //
    // It used to be a timing one as well, and that half is gone: a decorator
    // now runs on the clock of whichever transition names it
    // (resolveDecoratorClock), so `overlay` here would be a 0.4s dim rather
    // than the 0.7s one that was sized for cupertino. What that cost when the
    // durations were authored on the decorator, measured on a pop: the
    // dismissing screen was fully gone at 335ms while the screen underneath
    // still carried a 10% black wash, which reads as a grey cast appearing out
    // of nowhere and then lifting for no reason.
    //
    // The taste half stands on its own. A dim's job is depth under a screen
    // that SLIDES OVER another, and nothing here slides. One screen fades, the
    // other holds still, and a shared element travels above both — a wash over
    // the stationary screen is one more thing changing in frames that exist to
    // let the element be followed.
    //
    // A consumer who wants one names it: `createDecorator` is public, and
    // there is no longer a clock to match by hand.
    swipe: {
      direction: "y",
      // THIS ONE KEEPS ITS HOOKS, and it is the case that shows why the hooks
      // are not vestigial.
      //
      // The declarative drag walks a transition's own pop keyframes, and
      // layout's pop is a pure fade: `enterBack` is `opacity: 0` and nothing
      // moves. Its DRAG is not that — the screen is pulled down, with a slight
      // fade behind it, and only then does the fade take over. The shape
      // differs, not just the rate, so no progress mapping can express it.
      //
      // So layout drives its own screens, pays the release's first commit, and
      // is exactly the escape hatch `onMove` exists to be.
      onStart: async () => {
        return true;
      },
      onMove: (_, info, { animate, currentScreen, onProgress }) => {
        const { offset } = info;
        const dragY = offset.y;
        const clamped = Math.max(0, Math.min(56, dragY));
        const opacity = linear(clamped, [0, 56], [1, 0.96]);
        const extra = Math.max(0, dragY - 56);
        const extraRatio = Math.min(1, extra / 160);
        const resistedExtra = Math.sqrt(extraRatio) * 12;
        const finalY = Math.max(0, clamped + resistedExtra);
        const progress = Math.min(56, finalY);

        onProgress?.(true);

        animate(
          currentScreen,
          {
            y: finalY,
            opacity
          },
          {
            duration: 0
          }
        );

        return progress;
      },
      onEnd: async (_, info, { animate, currentScreen, prevScreen, onStart }) => {
        const { offset, velocity } = info;
        const dragY = offset.y;
        const isTriggered = dragY > 56 || velocity.y > 20;

        onStart?.(isTriggered);

        await Promise.all([
          animate(
            currentScreen,
            {
              y: isTriggered ? "100%" : 0,
              opacity: isTriggered ? 0.96 : 1
            },
            {
              duration: 0.3
            }
          ),
          animate(
            prevScreen,
            {
              y: 0,
              opacity: isTriggered ? 1 : 0.97
            },
            {
              duration: 0.3
            }
          )
        ]);

        return isTriggered;
      }
    }
  }
});

export default layout;
