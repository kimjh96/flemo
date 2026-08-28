import createMorphTransition from "@transition/morphTransition/createMorphTransition";

// The CONTAINER TRANSFORM: the tapped element opens into the next screen, and
// the screen it came from is zoomed along with it.
//
// `shared` moves one element and leaves the screens to their own transition.
// That is right when the element is one thing among many, and wrong when the
// element IS the navigation — a grid cell opening into a full-screen view. A
// grid that stays put underneath reads as the card escaping from it; what the
// eye expects is that the camera moved to the card, and the rest of the grid
// went past the edges because it was pushed there.
//
// So this preset is `shared` plus a camera (`carry: "screen"`): the runtime
// scales and translates the grid's screen by exactly the zoom that takes the
// element from one end of the flight to the other. Everything else follows for
// free, in both directions — on a pop the same zoom runs backwards, because
// the camera always lives with the screen the element is SMALL on.
//
// PAIR IT WITH A STILL SCREEN TRANSITION. The camera supersedes that screen's
// own transform for the flight (see `carry`), so `none` or an opacity-only
// transition composes; a slide is replaced rather than combined.
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

const zoom = createMorphTransition({
  name: "zoom",
  initial: {},
  idle: {
    value: {
      opacity: 1
    },
    options: {
      duration: 0
    }
  },
  enter: {
    value: {
      opacity: 1
    },
    options: {
      ease: EASE
    }
  },
  exit: {
    value: {
      opacity: 0
    },
    options: {
      ease: EASE
    }
  },
  options: {
    crossFade: 0.55,
    radius: true,
    carry: "screen",
    // The camera is a compositor transform and cannot be anything else, so
    // the card must ride the compositor with it — one clock — or WebKit
    // renders the two trembling against each other (see `mode` in typing.ts).
    mode: "transform"
  }
});

export default zoom;
