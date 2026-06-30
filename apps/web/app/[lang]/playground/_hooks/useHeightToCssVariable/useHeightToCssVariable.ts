import { useEffect } from "react";

import type { RefObject } from "react";

// Measures an element's height and publishes it as a CSS custom property on its
// nearest positioned ancestor, kept in sync via ResizeObserver. A sibling can
// then reserve exactly that space: the source panel uses it to clear the
// floating control dock, whose height changes as the transition chips wrap to
// more rows on narrow viewports.
export default function useHeightToCssVariable(
  ref: RefObject<HTMLElement | null>,
  variableName: string
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const target = element.offsetParent;
    if (!(target instanceof HTMLElement)) return;

    const publish = () => {
      target.style.setProperty(variableName, `${element.offsetHeight}px`);
    };
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(element);

    return () => {
      observer.disconnect();
      target.style.removeProperty(variableName);
    };
  }, [ref, variableName]);
}
