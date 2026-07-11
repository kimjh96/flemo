import type { CssDecl } from "@transition/compileTransitionStyles";

// ─────────────────────────────────────────────────────────────────────────────
// The swipe-settle scrubber: drives release animations (the motion that plays
// after a gesture lets go) on a main-thread clock instead of CSS transitions.
//
// A CSS transition starts from the element's CURRENT computed value — the one
// property of the release the settle driver must reproduce, since a finger can
// let go anywhere. A single-keyframe Web Animation has exactly that semantic:
// the missing "from" keyframe is filled from the underlying computed style.
// So each release becomes element.animate([to], timing) created PAUSED, and
// every active settle has its currentTime stepped from ONE shared rAF clock —
// the same compositor-jank immunity as the transition player, with browser-
// exact interpolation for any property a swipe handler animates.
//
// Settle frame gaps are deliberately NOT reported to the driver policy: a
// gesture release routinely overlaps consumer work (the commit the swipe
// triggers), which would read as device starvation and mis-demote.
//
// Takeover semantics mirror CSS-transition overwrites: a new write to a
// settling element pins the CURRENT animated values inline first, so the next
// motion departs from where the pixels visually are, never snapping back.
// ─────────────────────────────────────────────────────────────────────────────

export interface SettleScheduler {
  request: (callback: (time: number) => void) => number;
  cancel: (handle: number) => void;
}

const defaultScheduler = (): SettleScheduler => ({
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle)
});

export interface SettleTiming {
  durationMs: number;
  delayMs: number;
  // CSS easing string (the animation's own timing function; the clock feeds
  // raw time).
  easing: string;
}

// How the finalized values reach the element: the caller supplies the write so
// its inline-write tracking (clearInlineAnimation contract) stays in one place.
export type SettleWrite = (decl: CssDecl) => void;

interface ActiveSettle {
  element: HTMLElement;
  animation: Animation;
  decls: CssDecl[];
  totalMs: number;
  startTime: number | null;
  writeFinal: SettleWrite;
  resolve: () => void;
  backstop: ReturnType<typeof setTimeout>;
  settled: boolean;
}

const kebabToCamel = (property: string) =>
  property.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());

export interface SettleScrubber {
  // Start (or replace) a settle on the element. Returns null when WAAPI is
  // unavailable or rejects the keyframe — the caller then keeps its CSS
  // transition path, exactly as before.
  settle: (
    element: HTMLElement,
    decls: CssDecl[],
    timing: SettleTiming,
    writeFinal: SettleWrite
  ) => Promise<void> | null;
  // Pin a settling element's current values inline and drop its animation, so
  // an immediate write (a re-grab's duration-0 follow) is not overridden by a
  // lingering animation. No-op for elements that aren't settling.
  takeover: (element: HTMLElement) => void;
}

export const createSettleScrubber = (
  scheduler: SettleScheduler = defaultScheduler()
): SettleScrubber => {
  const active = new Map<HTMLElement, ActiveSettle>();
  let frameHandle: number | null = null;

  const stopClockIfIdle = () => {
    if (active.size === 0 && frameHandle !== null) {
      scheduler.cancel(frameHandle);
      frameHandle = null;
    }
  };

  // End a settle at its DESTINATION: the final values become inline styles
  // (the same end-state the CSS transition path left behind, so every
  // existing cleanup contract keeps working) and the animation is dropped.
  const finalize = (settle: ActiveSettle) => {
    if (settle.settled) return;
    settle.settled = true;
    clearTimeout(settle.backstop);
    active.delete(settle.element);
    if (settle.element.isConnected) {
      for (const decl of settle.decls) settle.writeFinal(decl);
    }
    settle.animation.cancel();
    settle.resolve();
    stopClockIfIdle();
  };

  // End a settle WHERE IT IS: pin the current animated values inline (CSS
  // transition overwrite semantics), then drop the animation.
  const takeover = (element: HTMLElement) => {
    const settle = active.get(element);
    if (!settle || settle.settled) return;
    settle.settled = true;
    clearTimeout(settle.backstop);
    active.delete(element);
    if (element.isConnected) {
      const computed = getComputedStyle(element);
      for (const decl of settle.decls) {
        const current = computed.getPropertyValue(decl.property);
        if (current !== "") settle.writeFinal({ property: decl.property, value: current });
      }
    }
    settle.animation.cancel();
    settle.resolve();
    stopClockIfIdle();
  };

  const step = (time: number) => {
    frameHandle = null;
    for (const settle of [...active.values()]) {
      if (settle.startTime === null) settle.startTime = time;
      const elapsed = time - settle.startTime;
      if (elapsed >= settle.totalMs) {
        finalize(settle);
      } else {
        settle.animation.currentTime = Math.max(0, elapsed);
      }
    }
    if (active.size > 0) frameHandle = scheduler.request(step);
  };

  return {
    settle: (element, decls, timing, writeFinal) => {
      if (typeof element.animate !== "function") return null;
      // A re-settle replaces the previous one, departing from its current
      // position (the previous animation still holds the pixels here).
      takeover(element);

      const keyframe: Record<string, string> = {};
      for (const decl of decls) keyframe[kebabToCamel(decl.property)] = decl.value;

      let animation: Animation;
      try {
        animation = element.animate([keyframe], {
          duration: Math.max(0, timing.durationMs),
          delay: Math.max(0, timing.delayMs),
          easing: timing.easing,
          // Holds the destination on the frame the clock lands exactly at the
          // end, until finalize commits it inline and cancels.
          fill: "forwards"
        });
        animation.pause();
        animation.currentTime = 0;
      } catch {
        return null;
      }

      const totalMs = Math.max(0, timing.durationMs) + Math.max(0, timing.delayMs);
      return new Promise<void>((resolve) => {
        const record: ActiveSettle = {
          element,
          animation,
          decls,
          totalMs,
          startTime: null,
          writeFinal,
          resolve,
          // Insurance, not the wait: rAF suspends in background tabs, and an
          // unresolved settle would hang the swipe handler's await.
          backstop: setTimeout(() => finalize(record), totalMs + 60),
          settled: false
        };
        active.set(element, record);
        if (frameHandle === null) frameHandle = scheduler.request(step);
      });
    },
    takeover
  };
};

// The app-wide scrubber animateInline drives; tests build their own with a
// fake scheduler.
const settleScrubber = createSettleScrubber();

export default settleScrubber;
