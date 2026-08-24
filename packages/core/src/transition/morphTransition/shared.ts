import createMorphTransition from "@transition/morphTransition/createMorphTransition";

// The built-in morph: the plain shared element. It travels, and the two sides
// trade places while they are still on top of each other.
//
// It authors no DURATION on purpose: a morph is not a transition of its own —
// it happens INSIDE one — so the runtime falls back to the length of whichever
// screen transition is flying (cupertino's 0.7s glide, material's, a
// consumer's), and the shared element lands with its screen under any of them.
//
// The CURVE is authored, and deliberately not inherited. A screen's fade can be
// front-loaded to get itself out of the way early (see the `layout` preset);
// travel borrowed from that curve would snap the element across and leave it
// sitting there for the rest of the flight.
//
// It is also NOT the iOS glide cupertino uses. That curve is 72% travelled at
// 32% of its clock, which reads as a glide over a 0.7s slide and as a JUMP over
// a 0.3s morph — frame-counted at 60fps: the element reached its destination in
// three frames and spent the remaining fifteen imperceptibly settling. A
// shared element is the thing the eye is following, so its motion has to be
// legible for the whole flight: this starts gently, covers ground in the
// middle, and decelerates into place.
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

const shared = createMorphTransition({
  name: "shared",
  // No opacity on the arrival: it is opaque from its first frame, and the GHOST
  // — the copy of what was there, carried inside the flight — is what dissolves
  // away on top of it. Fading both would bleed the background through the pair
  // by a(1 - a), right in the middle of the hand-over.
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
    radius: true
  }
});

export default shared;
