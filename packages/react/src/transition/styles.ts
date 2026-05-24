import { useInsertionEffect } from "react";

import {
  compileTransitionStyles,
  decoratorMap,
  isServer,
  transitionMap,
  type Decorator,
  type Transition
} from "@flemo/core";

const STYLE_TAG_ATTRIBUTE = "data-flemo";

const applyStyles = () => {
  if (isServer()) return;

  const css = compileTransitionStyles(transitionMap.values(), decoratorMap.values());
  let tag = document.head.querySelector<HTMLStyleElement>(`style[${STYLE_TAG_ATTRIBUTE}]`);
  if (!tag) {
    tag = document.createElement("style");
    tag.setAttribute(STYLE_TAG_ATTRIBUTE, "");
    document.head.appendChild(tag);
  }
  if (tag.textContent !== css) {
    tag.textContent = css;
  }
};

export default function useTransitionStyles(transitions: Transition[], decorators: Decorator[]) {
  // useInsertionEffect runs synchronously before any layout effect or paint,
  // so the stylesheet is in place by the time screens commit their data-* attrs.
  useInsertionEffect(() => {
    for (const t of transitions) transitionMap.set(t.name, t);
    for (const d of decorators) decoratorMap.set(d.name, d);
    applyStyles();
    return () => {
      for (const t of transitions) transitionMap.delete(t.name);
      for (const d of decorators) decoratorMap.delete(d.name);
      applyStyles();
    };
  }, [transitions, decorators]);
}
