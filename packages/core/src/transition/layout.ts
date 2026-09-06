import createTransition from "@transition/createTransition";

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

// How far the drag has actually pulled, for a finger that has gone `dragY`.
// One for one up to PULL, then a square-root falloff: the sheet keeps giving
// but tells you it has run out. The same curve material uses, for the same
// reason.
const PULL = 56;
const RESIST_OVER = 160;
const RESIST_MAX = 12;

const pull = (dragY: number): number => {
  const followed = Math.max(0, Math.min(PULL, dragY));
  const over = Math.max(0, dragY - PULL);
  return followed + Math.sqrt(Math.min(1, over / RESIST_OVER)) * RESIST_MAX;
};

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
      // 56px, the pull this sheet is built around: where letting go means
      // going rather than coming back.
      threshold: PULL,
      /**
       * THE DRAG IS NOT THIS TRANSITION'S POP, so it names where it goes.
       *
       * layout's pop is a pure fade and nothing moves. Its gesture is the
       * other thing entirely: the sheet is pulled down and, if it is let go,
       * slides out. Declaring that destination is what keeps the whole drag on
       * the scrub instead of writing the two screens a frame at a time and
       * paying for the release's first animation commit.
       *
       * The screen underneath holds through the gesture exactly as it holds
       * through the pop, so it names an empty destination and is not staged.
       */
      current: { y: "100%", opacity: 0.96 },
      prev: {},
      /**
       * The rubber band, and the only place it lives.
       *
       * The band is on the FINGER, not on the screen: the sheet follows one
       * for one to `PULL` and resists past it, and dividing that by the
       * screen's own height is where the sheet has reached along the slide it
       * would finish on a commit.
       *
       * The fade rides that same number rather than finishing at `PULL` as it
       * did when this was written by hand. At the pull point that is 0.997
       * against the 0.96 it used to be, which is under four percentage points
       * of opacity and does not survive being looked for.
       */
      progress: (info, span) => {
        const pulled = pull(info.offset.y);
        return { current: span > 0 ? pulled / span : 0, prev: 0 };
      }
    }
  }
});

export default layout;
