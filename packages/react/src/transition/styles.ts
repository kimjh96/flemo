import { useInsertionEffect } from "react";

import {
  applyTransitionStyles,
  decoratorMap,
  transitionMap,
  type Decorator,
  type Transition
} from "@flemo/core";

export default function useTransitionStyles(transitions: Transition[], decorators: Decorator[]) {
  // useInsertionEffect runs synchronously before any layout effect or paint,
  // so the stylesheet is in place by the time screens commit their data-* attrs.
  // Registration/cleanup is the React lifecycle's job; compiling + writing the
  // <style> tag is the framework-neutral applyTransitionStyles in @flemo/core.
  useInsertionEffect(() => {
    for (const t of transitions) transitionMap.set(t.name, t);
    for (const d of decorators) decoratorMap.set(d.name, d);
    applyTransitionStyles();
    return () => {
      for (const t of transitions) transitionMap.delete(t.name);
      for (const d of decorators) decoratorMap.delete(d.name);
      applyTransitionStyles();
    };
  }, [transitions, decorators]);
}
