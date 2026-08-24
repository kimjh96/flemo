import isServer from "@utils/isServer";

import { MORPH_SHEET_ATTR } from "@dom/attributes";

// The per-flight keyframe sheet.
//
// Every other animation in flemo is compiled once from its definition, because
// every other animation is fully known before a navigation starts. A morph is
// not: how far the element travels and how much it grows are two rects that
// only exist once the arriving screen has laid out. So its keyframes are
// inserted at the flight's start, with LITERAL values — no `var()` in the
// keyframe, which is the same discipline the compiled sheet keeps for its
// timing — and dropped when the flight lands.
//
// Insertion goes through CSSOM rather than rewriting `textContent`: a flight
// starts inside a layout effect, one style recalculation away from the frame
// the user sees, and re-parsing the whole sheet there is work the flight would
// pay for.
const sheet = (): CSSStyleSheet | null => {
  if (isServer()) return null;
  let tag = document.head.querySelector<HTMLStyleElement>(`style[${MORPH_SHEET_ATTR}]`);
  if (!tag) {
    tag = document.createElement("style");
    tag.setAttribute(MORPH_SHEET_ATTR, "");
    document.head.appendChild(tag);
  }
  return tag.sheet;
};

/**
 * Insert one flight's rules and return the disposer that removes exactly them.
 *
 * The rules are tracked by identity, not by index: a concurrent flight (two
 * morphing elements in one navigation, or a second navigation interrupting the
 * first) inserts and drops rules in between, and an index captured at insertion
 * would by then point at someone else's keyframes.
 */
export const insertMorphRules = (rules: string[]): (() => void) => {
  const target = sheet();
  if (!target) return () => {};

  const inserted: CSSRule[] = [];
  for (const rule of rules) {
    try {
      const index = target.insertRule(rule, target.cssRules.length);
      const cssRule = target.cssRules[index];
      if (cssRule) inserted.push(cssRule);
      /* v8 ignore next 4 -- a malformed rule is a bug in the emitter, not a
         runtime condition; the guard exists so one bad rule cannot leave a
         flight without its cleanup. */
    } catch {
      // Keep going: a partially inserted flight still cleans up below.
    }
  }

  return () => {
    for (const cssRule of inserted) {
      const index = Array.prototype.indexOf.call(target.cssRules, cssRule);
      if (index >= 0) target.deleteRule(index);
    }
    inserted.length = 0;
  };
};
