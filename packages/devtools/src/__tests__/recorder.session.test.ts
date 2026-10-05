import { afterEach, describe, expect, it, vi } from "vitest";

import { clearTrace, loadTrace, saveTrace, TRACE_KEY } from "../persistence";
import { attachTransitionRecorder } from "../recorder";

import type { TransitionRecord, TransitionRecorderHandle } from "../types";

// WHAT THE RECORDER KNOWS BEYOND THE FRAME NUMBERS: which shared elements
// moved, what the browser reported in a single frame, which comparison the
// transition belongs to, and what survives the next reload.

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const frames = async (count: number) => {
  for (let index = 0; index < count; index += 1) await frame();
};
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let handle: TransitionRecorderHandle | null = null;

const attach = (options?: Parameters<typeof attachTransitionRecorder>[0]) => {
  handle = attachTransitionRecorder(options);
  return handle;
};

afterEach(() => {
  handle?.detach();
  handle = null;
  document.body.innerHTML = "";
  clearTrace();
  sessionStorage.clear();
  delete (window as unknown as { flemo?: unknown }).flemo;
  vi.restoreAllMocks();
});

const mountScreen = (id = "screen-a") => {
  const screen = document.createElement("div");
  screen.setAttribute("data-flemo-screen", id);
  screen.setAttribute("data-flemo-status", "IDLE");
  screen.setAttribute("data-flemo-active", "false");
  document.body.appendChild(screen);
  return screen;
};

const morph = (parent: HTMLElement, key: string): HTMLElement => {
  const element = document.createElement("div");
  element.setAttribute("data-flemo-morph", "");
  element.setAttribute("data-flemo-morph-id", key);
  parent.appendChild(element);
  return element;
};

const animation = (type: string, name: string, elapsedTime = 0.4): Event => {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { animationName: name, elapsedTime });
  return event;
};

const move = async (screens: HTMLElement[], during?: () => void) => {
  for (const screen of screens) screen.setAttribute("data-flemo-status", "POPPING");
  screens[0].setAttribute("data-flemo-active", "true");
  await settle();
  during?.();
  await frames(2);
  await settle();
  for (const screen of screens) screen.setAttribute("data-flemo-status", "COMPLETED");
  await settle();
  await frames(4);
};

describe("shared elements, through the recorder", () => {
  it("reports a pair that never moved, and the anomaly that names it", async () => {
    const a = mountScreen("a");
    const b = mountScreen("b");
    morph(a, "hero");
    morph(b, "hero");
    attach();
    await settle();

    await move([a, b]);

    const transition = handle!.report().transitions[0];
    expect(transition.morphs.pairable).toEqual(["hero"]);
    expect(transition.morphs.skipped).toEqual(["hero"]);
    expect(transition.anomalies.some((entry) => entry.includes("did not move"))).toBe(true);
  });

  it("takes a role stamped mid-transition as proof the pair moved", async () => {
    const a = mountScreen("a");
    const b = mountScreen("b");
    const end = morph(a, "hero");
    morph(b, "hero");
    attach();
    await settle();

    await move([a, b], () => end.setAttribute("data-flemo-morph", "enter"));

    const transition = handle!.report().transitions[0];
    expect(transition.morphs.moved).toEqual(["hero"]);
    expect(transition.morphs.skipped).toEqual([]);
  });

  it("counts a ghost that arrives during the transition", async () => {
    const a = mountScreen("a");
    attach();
    await settle();

    await move([a], () => {
      const ghost = document.createElement("div");
      ghost.setAttribute("data-flemo-morph-ghost", "");
      a.appendChild(ghost);
    });

    expect(handle!.report().transitions[0].morphs.ghosts).toBe(1);
  });
});

describe("tripwires, through the recorder", () => {
  it("attributes a one-frame event to the transition it landed in", async () => {
    const a = mountScreen("a");
    attach();
    await settle();

    await move([a], () => {
      a.dispatchEvent(animation("animationcancel", "flemo-screen-cupertino-POPPING-true"));
    });

    const transition = handle!.report().transitions[0];
    expect(transition.tripwires.map((hit) => hit.kind)).toContain("animation-cancel");
    expect(transition.tripwires[0].atMs).toBeGreaterThanOrEqual(0);
    expect(transition.anomalies.some((entry) => entry.includes("tripwire animation-cancel"))).toBe(
      true
    );
  });

  it("drops a hit that landed while nothing was running", async () => {
    const a = mountScreen("a");
    attach();
    await settle();
    a.dispatchEvent(animation("animationcancel", "flemo-screen-x"));

    await move([a]);
    expect(handle!.report().transitions[0].tripwires).toEqual([]);
  });

  it("records when the first flemo keyframe actually started", async () => {
    const a = mountScreen("a");
    attach();
    await settle();

    await move([a], () => {
      a.dispatchEvent(animation("animationstart", "flemo-screen-cupertino-POPPING-true"));
      // A second start does not move the first.
      a.dispatchEvent(animation("animationstart", "flemo-bar-cupertino-POPPING-true"));
    });

    const { motion, ...rest } = handle!.report().transitions[0];
    expect(rest.id).toBe("transition-1");
    expect(motion.firstAnimationAtMs).not.toBeNull();
    expect(motion.firstAnimationAtMs).toBeGreaterThanOrEqual(0);
  });

  it("reports the animation channel as observed once anything fires", async () => {
    const a = mountScreen("a");
    attach();
    await settle();
    expect(handle!.report().environment.observation.animationEvents).toBe(false);

    a.dispatchEvent(animation("animationstart", "flemo-screen-x"));
    expect(handle!.report().environment.observation.animationEvents).toBe(true);
  });

  it("says out loud when transitions were recorded and the channel never fired", async () => {
    const a = mountScreen("a");
    attach();
    await settle();
    await move([a]);

    expect(
      handle!.report().verdict.some((line) => line.includes("animation channel observed NOTHING"))
    ).toBe(true);
  });
});

describe("comparison buckets", () => {
  it("labels transitions from the moment a bucket is armed, and compares them", async () => {
    const a = mountScreen("a");
    attach();
    await settle();

    expect(handle!.mark("A")).toBe("A");
    await move([a]);
    handle!.mark("B");
    await move([a]);
    // An empty label clears the bucket rather than creating one.
    expect(handle!.mark("")).toBeNull();
    await move([a]);

    const report = handle!.report();
    expect(report.transitions.map((transition) => transition.bucket)).toEqual([
      "A",
      "B",
      undefined
    ]);
    expect(report.comparison.map((entry) => entry.bucket)).toEqual(["A", "B"]);
    expect(report.comparison[0].transitions).toBe(1);
  });

  it("keeps a transition already in the air under the label it opened with", async () => {
    const a = mountScreen("a");
    attach();
    await settle();
    handle!.mark("A");

    a.setAttribute("data-flemo-status", "POPPING");
    a.setAttribute("data-flemo-active", "true");
    await settle();
    handle!.mark("B");
    await frames(2);
    a.setAttribute("data-flemo-status", "COMPLETED");
    await settle();
    await frames(3);

    expect(handle!.report().transitions[0].bucket).toBe("A");
  });

  it("reports no comparison at all until a bucket is used", async () => {
    const a = mountScreen("a");
    attach();
    await settle();
    await move([a]);
    expect(handle!.report().comparison).toEqual([]);
  });
});

describe("the trace across a page load", () => {
  it("restores the previous instance's transitions, kept apart from the live ones", async () => {
    saveTrace([{ id: "transition-99", kind: "PUSH" } as unknown as TransitionRecord], "4");
    attach();
    const report = handle!.report();
    expect(report.previousSession?.transitions[0].id).toBe("transition-99");
    expect(report.transitions).toEqual([]);
  });

  it("writes the trace when the page goes away, and not while a transition runs", async () => {
    const a = mountScreen("a");
    attach();
    await settle();
    await move([a]);

    document.dispatchEvent(new Event("visibilitychange"));
    // jsdom reports "visible", so nothing is written yet.
    expect(loadTrace("4")).toBeNull();

    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(loadTrace("4")?.transitions).toHaveLength(1);
    hidden.mockRestore();
  });

  it("marks the session as one that was hidden while recording", async () => {
    attach();
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    hidden.mockRestore();

    const foreground = handle!
      .report()
      .preconditions.find((check) => check.id === "page-foreground");
    expect(foreground?.status).toBe("violated");
  });

  it("keeps nothing at all when persistence is declined", async () => {
    const a = mountScreen("a");
    attach({ persist: false });
    await settle();
    await move([a]);

    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    hidden.mockRestore();
    expect(sessionStorage.getItem(TRACE_KEY)).toBeNull();
  });

  // RULE ONE OF persistence.ts: never write during a transition. sessionStorage is
  // synchronous main-thread I/O, and a JSON serialization of the whole buffer
  // inside a transition is exactly the long task this package exists to find.
  it("writes the trace on its own timer once the page is idle", async () => {
    vi.useFakeTimers();
    try {
      const a = mountScreen("a");
      attach();
      // One closed transition, then nothing in the air: the tick may write.
      a.setAttribute("data-flemo-status", "POPPING");
      await Promise.resolve();
      await Promise.resolve();
      a.setAttribute("data-flemo-status", "COMPLETED");
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(10_000);
      expect(loadTrace("4")?.transitions.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets its own timer run while a transition is in the air, and writes nothing", async () => {
    vi.useFakeTimers();
    try {
      saveTrace([{ id: "from-before" } as unknown as TransitionRecord], "4");
      const a = mountScreen("a");
      attach();
      a.setAttribute("data-flemo-status", "POPPING");
      // The observer delivers on a microtask; nothing here needs a real frame.
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(10_000);
      expect(loadTrace("4")?.transitions[0].id).toBe("from-before");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("what drove the session", () => {
  it("carries the input evidence onto the transition and into the preconditions", async () => {
    const a = mountScreen("a");
    attach();
    await settle();
    // Built by a script, so untrusted — which is exactly the signature a
    // synthetic probe leaves behind.
    a.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }));

    await move([a]);

    const report = handle!.report();
    expect(report.transitions[0].input.synthetic).toBe(1);
    expect(report.transitions[0].input.pointerTypes).toEqual(["mouse"]);
    const realInput = report.preconditions.find((check) => check.id === "real-input");
    expect(realInput?.status).toBe("violated");
    expect(report.verdict[0]).toContain("NOT EVIDENCE");
  });

  it("remembers an override that was set at attach and cleared since", () => {
    sessionStorage.setItem("flemo:sixty", "on");
    attach();
    sessionStorage.removeItem("flemo:sixty");

    const active = Object.keys(handle!.report().overrides.active);
    expect(active.some((key) => key.includes("since cleared"))).toBe(true);
  });
});
