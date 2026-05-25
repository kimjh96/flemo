import { easingToCss, targetToDecls } from "@flemo/core";

import type { SwipeAnimate } from "@flemo/core";

const isHTMLElement = (target: unknown): target is HTMLElement =>
  typeof HTMLElement !== "undefined" && target instanceof HTMLElement;

// Track every CSS property animateInline has written to a given element, so
// `clearInlineAnimation` can strip exactly that surface — regardless of which
// transition (built-in or custom) owns the property. Without this, the
// default-branch cleanup only stripped transform + opacity, leaking any other
// animated property (e.g., `filter` on the playground's `blur` transition).
const inlineWrites = new WeakMap<HTMLElement, Set<string>>();

const trackInlineWrite = (el: HTMLElement, property: string) => {
  let set = inlineWrites.get(el);
  if (!set) {
    set = new Set<string>();
    inlineWrites.set(el, set);
  }
  set.add(property);
};

// Drop any inline styles animateInline wrote (transform / opacity / filter /
// backgroundColor / ...) so the underlying CSS rules can take over (e.g.,
// after a swipe is cancelled, the CSS rest rule resumes). Pass an explicit
// `properties` list to override.
export const clearInlineAnimation = (el: HTMLElement, properties?: string[]) => {
  el.style.transition = "";
  if (properties) {
    const tracked = inlineWrites.get(el);
    for (const property of properties) {
      el.style.removeProperty(property);
      tracked?.delete(property);
    }
    return;
  }
  const tracked = inlineWrites.get(el);
  if (tracked && tracked.size > 0) {
    for (const property of tracked) {
      el.style.removeProperty(property);
    }
    tracked.clear();
    return;
  }
  // Untracked element (animateInline never wrote here): fall back to
  // stripping the two near-universal swipe targets so the contract stays
  // useful for callers that hand in an arbitrary element.
  el.style.removeProperty("transform");
  el.style.removeProperty("opacity");
};

// Imperative replacement for Motion's `animate()` inside transition swipe
// handlers. Mutates inline `transform`/`opacity`/etc. and the inline
// `transition` string. Returns a Promise that resolves on transitionend or a
// duration-based timeout (safety net for transitionend that never fires —
// e.g., when the property value didn't actually change).
const animateInline: SwipeAnimate = (target, value, options = {}) => {
  if (!isHTMLElement(target)) return Promise.resolve();
  const el = target;

  const decls = targetToDecls(value);
  if (decls.length === 0) return Promise.resolve();

  const duration = typeof options.duration === "number" ? options.duration : 0;
  const delay = typeof options.delay === "number" && options.delay > 0 ? options.delay : 0;
  const easing = easingToCss(options.ease);

  if (duration <= 0 && delay <= 0) {
    el.style.transition = "none";
    for (const d of decls) {
      el.style.setProperty(d.property, d.value);
      trackInlineWrite(el, d.property);
    }
    return Promise.resolve();
  }

  const transitionList = decls
    .map((d) => `${d.property} ${duration}s ${easing} ${delay}s`)
    .join(", ");
  el.style.transition = transitionList;
  // Force a reflow so the new `transition` value is in effect before we set
  // the target values (some browsers otherwise coalesce property mutations).
  void el.offsetWidth;
  for (const d of decls) {
    el.style.setProperty(d.property, d.value);
    trackInlineWrite(el, d.property);
  }

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
};

export default animateInline;
