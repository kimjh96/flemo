import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";

import type { AnimationOptions, Target } from "motion/react";

type AnimateOptions = Omit<AnimationOptions, "delay"> & { delay?: number };

const isHTMLElement = (target: unknown): target is HTMLElement =>
  typeof HTMLElement !== "undefined" && target instanceof HTMLElement;

// Drop any inline transform/opacity/etc. so the underlying CSS rules can
// take over (e.g., after a swipe is cancelled, the CSS rest rule resumes).
export const clearInlineAnimation = (el: HTMLElement, properties?: string[]) => {
  el.style.transition = "";
  if (!properties) {
    el.style.removeProperty("transform");
    el.style.removeProperty("opacity");
    return;
  }
  for (const property of properties) {
    el.style.removeProperty(property);
  }
};

// Imperative replacement for Motion's `animate()` inside transition swipe
// handlers. Mutates inline `transform`/`opacity`/etc. and the inline
// `transition` string. Returns a Promise that resolves on transitionend or a
// duration-based timeout (safety net for transitionend that never fires —
// e.g., when the property value didn't actually change).
export default function animateInline(
  target: object,
  value: Target,
  options: AnimateOptions = {}
): Promise<void> {
  if (!isHTMLElement(target)) return Promise.resolve();
  const el = target;

  const decls = targetToDecls(value);
  if (decls.length === 0) return Promise.resolve();

  const duration = typeof options.duration === "number" ? options.duration : 0;
  const delay = typeof options.delay === "number" && options.delay > 0 ? options.delay : 0;
  const easing = easingToCss(options.ease);

  if (duration <= 0 && delay <= 0) {
    el.style.transition = "none";
    for (const d of decls) el.style.setProperty(d.property, d.value);
    return Promise.resolve();
  }

  const transitionList = decls
    .map((d) => `${d.property} ${duration}s ${easing} ${delay}s`)
    .join(", ");
  el.style.transition = transitionList;
  // Force a reflow so the new `transition` value is in effect before we set
  // the target values (some browsers otherwise coalesce property mutations).
  void el.offsetWidth;
  for (const d of decls) el.style.setProperty(d.property, d.value);

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener("transitionend", onEnd);
      resolve();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target !== el) return;
      finish();
    };
    el.addEventListener("transitionend", onEnd);
    setTimeout(finish, (duration + delay) * 1000 + 60);
  });
}
