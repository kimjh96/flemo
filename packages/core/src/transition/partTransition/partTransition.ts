import type { BaseTransition, Transition } from "@transition/typing";

import { resolvePartClock } from "@transition/partTransition/resolvePartClock";

import type { PartTransition, PartTransitionName } from "@transition/partTransition/typing";

// Request-agnostic registry of part transitions, mirroring transitionMap /
// decoratorMap. A binding registers the consumer's createPartTransition results
// here (see useTransitionStyles) so the compiler can emit their CSS and
// <Part name="..."> can resolve them. Empty by default — bar
// transitions are entirely consumer-defined.
export const partTransitionMap = new Map<PartTransitionName, PartTransition>();

/**
 * A registered part, with the clock the CURRENT flight gives it.
 *
 * Every reader of a part's timing goes through here, because the compiled CSS
 * does: the rule a part actually runs carries the resolved clock (see
 * resolvePartClock and the pair pass in compileTransitionStyles), so a reader
 * that resolved the authored variants instead would disagree with the glass.
 * That disagreement is not cosmetic — the choreography span decides how long
 * the whole flight stays open, and the layer pin decides what stays promoted
 * across the COMPLETED flip.
 *
 * `transition` is null only where there is no flight to inherit from, which is
 * a part mounted outside any screen. It then reads exactly what it authored,
 * matching the by-name rule that is the only one such a part selects.
 */
export const resolvePartDefinition = (
  name: string | null,
  transition: Pick<Transition, "variants"> | null
): Pick<BaseTransition, "initial" | "variants"> | undefined => {
  if (name === null) return undefined;
  const authored = partTransitionMap.get(name as PartTransitionName);
  if (!authored) return undefined;
  return transition ? resolvePartClock(transition, authored) : authored;
};
