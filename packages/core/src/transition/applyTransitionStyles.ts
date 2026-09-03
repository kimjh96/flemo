import { compileTransitionStyles } from "@transition/compileTransitionStyles";

import { transitionMap } from "@transition/transition";

import isServer from "@utils/isServer";

import { decoratorMap } from "@transition/decorator/decorator";
import { partTransitionMap } from "@transition/partTransition/partTransition";

const STYLE_TAG_ATTRIBUTE = "data-flemo";

// COMPILING IS THE EXPENSIVE PART, AND IT IS ASKED FOR CONSTANTLY.
//
// A binding registers its Router's definitions from an effect keyed on the
// arrays it was handed, and the natural way to hand them over is a literal:
//
//   <Router transitions={[reveal, drift, sheet, aperture]} />
//
// That array is a new one on every render, so the effect tears down and runs
// again — unregister, recompile, register, recompile — for a set of definitions
// that did not change. Two full compiles per render, per mounted Router, and a
// stack keeps its Routers: profiled on the site's own shell, one 237ms
// self-time frame per navigation after the playground had been visited once,
// growing with every visit as another of its Routers joined the stack.
//
// The registry is a set of NAMED definitions, so the same names carrying the
// same definitions compile to the same CSS by construction. Keying on that
// makes the churn free: the unregister lands on one signature and the register
// lands back on the previous one, and after the first cycle both are hits.
//
// A definition may legitimately be REPLACED under a name it already holds (a
// hot reload, a consumer swapping one at runtime), so identity is part of the
// key rather than the name alone. Objects cannot be put in a string key, so
// each one is tagged once with a serial and the tag travels instead.
const serials = new WeakMap<object, number>();
let nextSerial = 0;
const serialOf = (definition: object): number => {
  const seen = serials.get(definition);
  if (seen !== undefined) return seen;
  nextSerial += 1;
  serials.set(definition, nextSerial);
  return nextSerial;
};

const signature = (): string =>
  [transitionMap, decoratorMap, partTransitionMap]
    .map((registry) =>
      [...registry.entries()]
        .map(([name, definition]) => `${name}:${serialOf(definition)}`)
        .join(",")
    )
    .join("|");

// Two entries would do for the register/unregister pair alone; four leaves room
// for a nested Router's own churn to interleave with its parent's without
// evicting the state either of them keeps returning to.
const CACHE_LIMIT = 4;
const compiled = new Map<string, string>();

const compileForSignature = (key: string): string => {
  const hit = compiled.get(key);
  if (hit !== undefined) return hit;
  const css = compileTransitionStyles(
    transitionMap.values(),
    decoratorMap.values(),
    partTransitionMap.values()
  );
  if (compiled.size >= CACHE_LIMIT) {
    const oldest = compiled.keys().next();
    /* v8 ignore next -- the size check above is what guarantees a first key. */
    if (!oldest.done) compiled.delete(oldest.value);
  }
  compiled.set(key, css);
  return css;
};

// Compile every registered transition + decorator into a single
// `<style data-flemo>` in <head>, creating the tag once and only rewriting it
// when the CSS actually changes. No-op on the server. Framework-neutral DOM: a
// binding calls this after it (un)registers entries in the shared maps.
export default function applyTransitionStyles() {
  /* v8 ignore next -- there is no document to write the sheet into. */
  if (isServer()) return;

  const css = compileForSignature(signature());
  let tag = document.head.querySelector<HTMLStyleElement>(`style[${STYLE_TAG_ATTRIBUTE}]`);
  if (!tag) {
    tag = document.createElement("style");
    tag.setAttribute(STYLE_TAG_ATTRIBUTE, "");
    document.head.appendChild(tag);
  }
  if (tag.textContent !== css) {
    tag.textContent = css;
  }
}
