import { useInsertionEffect } from "react";

import {
  registerTransitionDefinitions,
  type Decorator,
  type MorphTransition,
  type PartTransition,
  type Transition
} from "@flemo/core";

export default function useTransitionStyles(
  transitions: Transition[],
  decorators: Decorator[],
  partTransitions: PartTransition[] = [],
  morphTransitions: MorphTransition[] = []
) {
  // useInsertionEffect runs synchronously before any layout effect or paint,
  // so the stylesheet is in place by the time screens commit their data-* attrs.
  // The React lifecycle only picks WHEN; registering the maps, compiling, and
  // writing the <style> tag is @flemo/core's registerTransitionDefinitions.
  useInsertionEffect(
    () => registerTransitionDefinitions(transitions, decorators, partTransitions, morphTransitions),
    [transitions, decorators, partTransitions, morphTransitions]
  );
}
