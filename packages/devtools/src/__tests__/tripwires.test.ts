import { afterEach, describe, expect, it, vi } from "vitest";

import { attachTripwires, INPUT_WINDOW_MS, relativeHit } from "../tripwires";

import type { TripwireHandle, TripwireOptions } from "../tripwires";

// TRIPWIRES ARE THE THINGS THE RECORDER IS TOLD ABOUT.
//
// Every other probe samples. The three defects that cost this project the most
// lasted ONE FRAME, and a sampler that looks three times a second sees none of
// them — so these are listeners, and these tests fire the exact events the
// browser fires.

let handle: TripwireHandle | null = null;

const attach = (over: Partial<TripwireOptions> = {}) => {
  const hits: { kind: string; detail: string; atMs: number }[] = [];
  const starts: number[] = [];
  handle = attachTripwires({
    onHit: (hit) => hits.push(hit),
    onAnimationStart: (atMs) => starts.push(atMs),
    ...over
  });
  return { hits, starts };
};

// jsdom ships no `AnimationEvent` constructor, so the two fields the tripwires
// read are attached to a plain bubbling Event — which is what the listeners
// actually see.
const animation = (type: string, name: string, elapsedTime = 0.4): Event => {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { animationName: name, elapsedTime });
  return event;
};

afterEach(() => {
  handle?.detach();
  handle = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("animation tripwires", () => {
  it("reports a cancelled flemo animation, naming what it means", () => {
    const { hits } = attach();
    const screen = document.createElement("div");
    screen.setAttribute("data-flemo-screen", "a");
    document.body.appendChild(screen);

    screen.dispatchEvent(animation("animationcancel", "flemo-screen-cupertino-POPPING-true"));

    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("animation-cancel");
    expect(hits[0].detail).toContain("re-parented");
    expect(hits[0].detail).toContain("(screen)");
  });

  it("reports an animationend that carried no elapsed time at all", () => {
    const { hits } = attach();
    document.dispatchEvent(animation("animationend", "flemo-morph-3-travel", 0));
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("zero-length-animation-end");
    expect(hits[0].detail).toContain("without ever running");
  });

  it("describes a target that is not a screen without calling it one", () => {
    const { hits } = attach();
    const bar = document.createElement("nav");
    document.body.appendChild(bar);
    bar.dispatchEvent(animation("animationcancel", "flemo-bar-cupertino-POPPING-true"));
    expect(hits[0].detail).toContain("<nav>");
    expect(hits[0].detail).not.toContain("(screen)");
  });

  it("says nothing about an animationend that ran", () => {
    const { hits } = attach();
    document.dispatchEvent(animation("animationend", "flemo-morph-3-travel", 0.4));
    expect(hits).toEqual([]);
  });

  it("ignores a consumer's own animations entirely", () => {
    const { hits, starts } = attach();
    document.dispatchEvent(animation("animationcancel", "spin"));
    document.dispatchEvent(animation("animationend", "spin", 0));
    document.dispatchEvent(animation("animationstart", "spin"));
    expect(hits).toEqual([]);
    expect(starts).toEqual([]);
    expect(handle!.sawAnimationEvent()).toBe(false);
  });

  it("reports when the first flemo keyframe actually started", () => {
    const { starts } = attach();
    document.dispatchEvent(animation("animationstart", "flemo-screen-cupertino-PUSHING-true"));
    expect(starts).toHaveLength(1);
    expect(handle!.sawAnimationEvent()).toBe(true);
  });

  it("stops reporting once detached", () => {
    const { hits } = attach();
    handle!.detach();
    document.dispatchEvent(animation("animationcancel", "flemo-x"));
    expect(hits).toEqual([]);
  });
});

describe("what drove the navigation", () => {
  const pointer = (type: string, over: PointerEventInit = {}) =>
    new PointerEvent(type, { bubbles: true, ...over });

  it("separates a trusted finger from a script's dispatch", () => {
    attach();
    // Events built in a test are untrusted by construction, which is exactly
    // the signature a synthetic probe leaves.
    document.dispatchEvent(pointer("pointerdown", { pointerType: "touch" }));
    document.dispatchEvent(pointer("pointerdown", { pointerType: "mouse" }));

    const evidence = handle!.inputBetween(performance.now(), performance.now() + 10);
    expect(evidence.synthetic).toBe(2);
    expect(evidence.trusted).toBe(0);
    expect(evidence.pointerTypes).toEqual(["mouse", "touch"]);
  });

  it("falls back to the event's own type when the browser reports no pointer type", () => {
    attach();
    document.dispatchEvent(new Event("click", { bubbles: true }));
    expect(handle!.inputBetween(performance.now(), performance.now() + 10).pointerTypes).toEqual([
      "click"
    ]);
  });

  it("only counts input inside the window that could have caused the flight", () => {
    attach();
    document.dispatchEvent(pointer("pointerdown", { pointerType: "touch" }));
    const now = performance.now();
    // A flight that opened long after this input did not come from it.
    const evidence = handle!.inputBetween(now + INPUT_WINDOW_MS + 500, now + INPUT_WINDOW_MS + 600);
    expect(evidence.synthetic).toBe(0);
    expect(evidence.pointerTypes).toEqual([]);
  });

  it("keeps a bounded trail rather than a session's worth of events", () => {
    attach();
    for (let index = 0; index < 60; index += 1) {
      document.dispatchEvent(pointer("pointerdown", { pointerType: "touch" }));
    }
    const evidence = handle!.inputBetween(performance.now(), performance.now() + 10);
    expect(evidence.synthetic).toBeLessThanOrEqual(40);
  });
});

describe("without a document", () => {
  it("hands back an inert handle rather than making the caller branch", () => {
    const original = globalThis.document;
    // @ts-expect-error deliberately removing the global for this case
    delete globalThis.document;
    const inert = attachTripwires({ onHit: () => {}, onAnimationStart: () => {} });
    expect(inert.sawAnimationEvent()).toBe(false);
    expect(inert.inputBetween(0, 1)).toEqual({ trusted: 0, synthetic: 0, pointerTypes: [] });
    inert.detach();
    globalThis.document = original;
  });
});

describe("relativeHit", () => {
  it("puts an absolute moment back on the flight's own clock", () => {
    expect(relativeHit({ kind: "hold-reassert", detail: "x", atMs: 1041.26 }, 1000)).toEqual({
      kind: "hold-reassert",
      atMs: 41.3,
      detail: "x"
    });
  });
});
