import createMorphTransition from "@transition/morphTransition/createMorphTransition";

// The morph for TEXT.
//
// It differs from `shared` in one decision: it carries no ghost. A heading and
// the label it came from are the same words at two sizes, so there is nothing
// to dissolve between — the type simply GROWS into place (every morph
// interpolates font-size, which is a real re-typeset at every size, not a
// scaled bitmap). A copy fading out over it would only show the same words
// twice.
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

/**
 * The morph for TEXT, registered as `"text"` (the export is `textMorph`).
 *
 * It differs from `shared` in carrying no ghost: a heading and the label it
 * came from are the same words at two sizes, so the type simply grows into
 * place and a copy fading over it would show the same words twice. Use it for
 * the paired text inside a container Morph, where ordinary text would ghost
 * departure glyphs over arrival glyphs.
 */
const text = createMorphTransition({
  name: "text",
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
    crossFade: 0,
    // A text box's corner is not the thing being morphed, and animating it
    // repaints the glyphs every frame for nothing.
    radius: false
  }
});

export default text;
