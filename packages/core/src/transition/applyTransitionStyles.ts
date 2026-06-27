import { compileTransitionStyles } from "@transition/compileTransitionStyles";

import { transitionMap } from "@transition/transition";

import isServer from "@utils/isServer";

import { decoratorMap } from "@transition/decorator/decorator";
import { partTransitionMap } from "@transition/partTransition/partTransition";

const STYLE_TAG_ATTRIBUTE = "data-flemo";

// Compile every registered transition + decorator into a single
// `<style data-flemo>` in <head>, creating the tag once and only rewriting it
// when the CSS actually changes. No-op on the server. Framework-neutral DOM: a
// binding calls this after it (un)registers entries in the shared maps.
export default function applyTransitionStyles() {
  if (isServer()) return;

  const css = compileTransitionStyles(
    transitionMap.values(),
    decoratorMap.values(),
    partTransitionMap.values()
  );
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
