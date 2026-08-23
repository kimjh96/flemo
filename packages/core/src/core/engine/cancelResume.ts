import { clearInlineAnimation, trackInlineWrite } from "@transition/animateInline";
import { matchesFlightAnimationName } from "@transition/compileTransitionStyles";
import type { VariantMotion } from "@transition/variantMotion";

// CANCEL-RESUME: putting a browser-cancelled compiled animation back on its
// own timeline.
//
// WebKit cancels a running CSS animation whenever a commit invalidates the
// element's style in a way that drops the animation — a suspended mount
// resolving mid-flight is the common one. Left alone the participant simply
// stops where it was and the flight dies silently under the incoming screen.
//
// The fix is to restart it with a NEGATIVE inline `animation-delay` equal to
// the elapsed time, so the replay rejoins the original clock instead of
// starting over. A budget bounds the churn: an element whose commits keep
// re-invalidating it concedes rather than looping.

// Cancel-resume budget: how many browser-cancels of one element's compiled
// animation the engine will resume before conceding (the active scope then
// resolves its task; a pure-resume participant simply stops). Bounds the churn
// of a suspended-mount commit re-invalidating the layer repeatedly.
export const RESUME_BUDGET = 4;

// Whole-millisecond CSS time string. Guards against float noise in the inline
// `animation-delay` (e.g. -0.075 instead of -0.07500000000000001).
const cssSeconds = (seconds: number) => `${Math.round(seconds * 1000) / 1000}s`;

export interface CancelResumeConfig {
  element: HTMLElement;
  // The compiled animation name this element runs; cancels of any other name
  // (a decorator's, a foreign transition's) are ignored.
  expectedName: string;
  // The variant's timing, for the resume clamp and the rejoin delay.
  motion: VariantMotion;
  // Whether recovery may still act: the transition is current, the element is
  // live, and no swipe committed it out. A dead participant terminates.
  isLive: () => boolean;
  budgetUsed: () => number;
  spendBudget: () => void;
  // Budget spent, clock past the end, or not live. The active scope resolves
  // its task; a pure-resume participant does nothing.
  onTerminal: () => void;
  // The lease writer for the rejoin delay (the engine instance's token), so
  // ownership holds end-to-end instead of falling back to the global stake.
  writer?: symbol;
}

// Wire cancel-resume liveness on ONE compiled-CSS participant. WebKit silently
// cancels a running compositor animation when a sibling commit churns the
// layer (a Suspense fallback mounting mid-transition); the animation fires
// `animationcancel` and NEVER `animationend`. Rather than replay from the
// start (a visible jump) or resolve early (a single-frame cut), this
// re-establishes the compiled animation rejoined to its ORIGINAL timeline: the
// standard drop-reflow-restore trick plus an inline `animation-delay` that
// rewinds the clock to where the cancel landed (negative past the delay phase,
// so the resume picks up mid-flight and ends on the original schedule).
export const wireCancelResume = (config: CancelResumeConfig) => {
  const { element, expectedName, motion } = config;
  // True only during our own drop-reflow-restore mutation, so a synchronous
  // cancel/start the real compositor emits from it is ignored (jsdom fires
  // neither, but the guard keeps the browser path re-entrancy-safe).
  let midRestart = false;
  // Whether this recovery has written an inline rejoin delay that outlives it
  // if not cleaned: an interrupt (a NEW transition superseding this one on the
  // same element) tears the controller down before COMPLETED runs its own
  // clearInlineAnimation, so detach must restore the delay itself — otherwise
  // the next transition inherits the stale negative delay and starts mid-way.
  let wroteRejoinDelay = false;

  // Standard restart trick (drop → reflow → restore the compiled rule), with
  // one of three treatments for the inline rejoin delay:
  //   "keep"  — leave it untouched (a plain restart of an animation that never
  //             entered its active phase, so there's no rejoin delay to manage);
  //   "set"   — write the negative rejoin delay that resumes mid-flight;
  //   "clear" — strip any rejoin delay (a watchdog full-restart from `from`).
  const restart = (delay: { mode: "keep" | "clear" } | { mode: "set"; seconds: number }) => {
    midRestart = true;
    element.style.animation = "none";
    void element.offsetWidth;
    element.style.removeProperty("animation");
    if (delay.mode === "clear") {
      element.style.removeProperty("animation-delay");
      wroteRejoinDelay = false;
    } else if (delay.mode === "set") {
      trackInlineWrite(element, "animation-delay", config.writer);
      element.style.animationDelay = cssSeconds(delay.seconds);
      wroteRejoinDelay = true;
    }
    midRestart = false;
  };

  const onCancel = (event: AnimationEvent) => {
    if (midRestart) return;
    // A head tier fires under a suffixed keyframe name (`<name>-gov`,
    // `<name>-deskhead`) — same flight, same resolver.
    if (
      event.target !== element ||
      !matchesFlightAnimationName(event.animationName, expectedName)
    ) {
      return;
    }
    if (!config.isLive() || config.budgetUsed() >= RESUME_BUDGET) {
      config.onTerminal();
      return;
    }
    // The ACTIVE-phase time elapsed at cancel, straight from the event (CSS
    // Animations spec: animationcancel.elapsedTime is the active duration
    // elapsed, EXCLUDING delay — 0 if cancelled while still delaying, and
    // it already accounts for a negative rejoin delay on a re-cancel). This
    // is the authoritative resume point: the old performance.now()-since-
    // animationstart bookkeeping re-added `motion.delay` and, for a POSITIVE
    // delay, made a mid-active cancel wait the delay out all over again.
    const activeElapsedMs = Math.max(0, event.elapsedTime * 1000);
    const durationMs = motion.duration * 1000;
    // durationMs > 0 guard: a duration-0 variant (delay-only authoring) would
    // otherwise read `0 >= 0` as finished and skip its remaining delay — it
    // must take the replay path below instead.
    if (durationMs > 0 && activeElapsedMs >= durationMs) {
      // Past the active end — the compiled rest rule owns the pose.
      config.onTerminal();
      return;
    }
    config.spendBudget();
    if (activeElapsedMs <= 0) {
      // Cancelled during the delay (or exactly at active start): nothing of
      // the active phase was presented, so replay delay + motion from the
      // top. ACCEPTED trade-off: the event carries no delay-phase position
      // (elapsedTime is active-only, 0 while delaying), so the authored delay
      // replays in full rather than resuming its remainder — visually
      // seamless (the from-pose showed throughout the delay and keeps
      // showing), merely late for pathologically long authored delays.
      // Preserving the exact position would need the wall-clock bookkeeping
      // whose delay-double-count bug this event-based model replaced.
      restart({ mode: "keep" });
      return;
    }
    // Resume INTO the active phase: a negative delay of the elapsed active
    // time, and NO re-delay (the browser already consumed the authored delay).
    restart({ mode: "set", seconds: -activeElapsedMs / 1000 });
  };

  return {
    // Attach is explicit so the active scope can construct the controller (the
    // watchdog needs its fullRestart) without wiring the listener on the
    // player-driven path, where it'd catch the join's own `animation: none`.
    attach: () => {
      element.addEventListener("animationcancel", onCancel);
    },
    detach: () => {
      element.removeEventListener("animationcancel", onCancel);
      // Restore the rejoin delay to the consumer's original (via the lease) so
      // an interrupt never bleeds this transition's clock offset into the next.
      if (wroteRejoinDelay) {
        clearInlineAnimation(element, ["animation-delay"], config.writer);
        wroteRejoinDelay = false;
      }
    },
    // Watchdog full-restart: replay from the compiled `from` on a fresh clock,
    // dropping any rejoin delay.
    fullRestart: () => {
      restart({ mode: "clear" });
    }
  };
};
