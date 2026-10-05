"use client";

import { useEffect, useState, type RefObject } from "react";

// Whether a self-playing demo may play right now: it is on screen, the visitor
// has not touched it in the last `idleMs`, and they have not asked the system
// for reduced motion. A touch hands the demo over to the visitor; it resumes on
// its own once they leave it alone.
export default function useAutoplayGate(
  ref: RefObject<HTMLElement | null>,
  idleMs = 9000
): boolean {
  const [visible, setVisible] = useState(false);
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
      element.removeEventListener("pointerdown", touch);
      media.removeEventListener("change", onMedia);
      window.clearTimeout(timer);
    };
  }, [ref, idleMs]);

  return visible && !touched && !reduced;
}
