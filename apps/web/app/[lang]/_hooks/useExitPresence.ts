"use client";

import { useEffect, useRef, useState, type AnimationEvent } from "react";

// Keeps an overlay on screen through its close animation. It mounts in the same
// commit `open` turns true, so its first frame is already the open animation,
// and after `open` turns false it stays until its own `animationend`. The
// backstop covers an end that never arrives: a hidden tab, or the overlay
// hidden by a breakpoint, where no animation runs at all. `onExited` runs once,
// when it leaves.
export default function useExitPresence(
  open: boolean,
  onExited?: () => void,
  backstopMs = 300
): { present: boolean; onAnimationEnd: (event: AnimationEvent<HTMLElement>) => void } {
  const [lingering, setLingering] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const lingeringRef = useRef(false);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  const leave = () => {
    if (!lingeringRef.current) return;
    lingeringRef.current = false;
    setLingering(false);
    onExitedRef.current?.();
  };
  const leaveRef = useRef(leave);
  leaveRef.current = leave;

  useEffect(() => {
    if (open) {
      lingeringRef.current = true;
      setLingering(true);
      return undefined;
    }
    const backstop = window.setTimeout(() => leaveRef.current(), backstopMs);
    return () => window.clearTimeout(backstop);
  }, [open, backstopMs]);

  const onAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && !openRef.current) leave();
  };

  return { present: open || lingering, onAnimationEnd };
}
