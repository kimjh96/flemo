import shared from "@transition/morphTransition/shared";
import text from "@transition/morphTransition/text";
import zoom from "@transition/morphTransition/zoom";

import type { MorphTransition, MorphTransitionName } from "@transition/morphTransition/typing";

// Request-agnostic registry of morph transitions, mirroring transitionMap /
// decoratorMap / partTransitionMap. A binding registers the consumer's
// createMorphTransition results here (see registerTransitionDefinitions) so the
// morph runtime can resolve a name to its timing and targets.
//
// Unlike the others this map feeds no compiled stylesheet: a morph's keyframes
// depend on two rects that only exist once a flight starts, so they are emitted
// per flight (see @morph/morphSheet) instead of at registration.
export const morphTransitionMap = new Map<MorphTransitionName, MorphTransition>([
  ["shared", shared],
  ["text", text],
  ["zoom", zoom]
]);
