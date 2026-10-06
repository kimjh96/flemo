"use client";

import { useEffect, useState, type RefObject } from "react";

// Whether a self-playing demo may play right now: it is on screen, the page it
// sits on is the one showing, the visitor has not touched it in the last
// `idleMs`, and they have not asked the system for reduced motion. A touch hands the demo over to the visitor; it resumes on
// its own once they leave it alone.
export default function useAutoplayGate(
  ref: RefObject<HTMLElement | null>,
  idleMs = 9000
): boolean {
  const [visible, setVisible] = useState(false);
  const [showing, setShowing] = useState(true);
  const [touched, setTouched] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      {
        threshold: 0.35
      }
    );
    observer.observe(element);

    // A page another page covers still intersects the viewport, so the
    // IntersectionObserver keeps calling it visible. Every flemo screen around
    // the demo has to be the active one: a demo on a covered page played on,
    // and a page turn froze its Router mid-transition until the reader came back.
    const screens: Element[] = [];
    for (
      let screen = element.closest("[data-flemo-screen]");
      screen;
      screen = screen.parentElement?.closest("[data-flemo-screen]") ?? null
    ) {
      screens.push(screen);
    }
    const readShowing = () =>
      setShowing(screens.every((screen) => screen.getAttribute("data-flemo-active") !== "false"));
    readShowing();
    const activity = new MutationObserver(readShowing);
    for (const screen of screens) {
      activity.observe(screen, { attributes: true, attributeFilter: ["data-flemo-active"] });
    }

    let timer = 0;
    const touch = () => {
      setTouched(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTouched(false), idleMs);
    };
    element.addEventListener("pointerdown", touch);

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const onMedia = () => setReduced(media.matches);
    media.addEventListener("change", onMedia);

    return () => {
      observer.disconnect();
      activity.disconnect();
      element.removeEventListener("pointerdown", touch);
      media.removeEventListener("change", onMedia);
      window.clearTimeout(timer);
    };
  }, [ref, idleMs]);

  return visible && showing && !touched && !reduced;
}
