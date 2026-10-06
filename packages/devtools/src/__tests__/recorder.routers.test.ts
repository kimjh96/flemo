import { afterEach, describe, expect, it } from "vitest";

import { attachTransitionRecorder } from "../recorder";

import type { TransitionRecorderHandle } from "../types";

// TWO ROUTERS MOVING AT ONCE ARE TWO TRANSITIONS.
//
// flemo.dev's doc pages hold live demos, each its own Router, autoplaying
// while the reader turns the page. The recorder kept ONE open transition for
// "any screen is moving", so a demo's push, another demo's pop and the page
// turn became a single 3.9s record over 7 screens: the first demo's finished
// screens read as a 2.3s stall, the second Router's fresh hold as a hold
// re-asserted on the first, and every animation event of the page landed in it.

const frame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const frames = async (count: number) => {
  for (let index = 0; index < count; index += 1) await frame();
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let handle: TransitionRecorderHandle | null = null;

afterEach(() => {
  handle?.detach();
  handle = null;
  document.body.innerHTML = "";
  sessionStorage.clear();
  localStorage.clear();
  delete (window as unknown as { flemo?: unknown }).flemo;
});

const mountScreen = (router: string, parent: Element = document.body) => {
  const screen = document.createElement("div");
  screen.setAttribute("data-flemo-screen", "");
  screen.setAttribute("data-flemo-status", "IDLE");
  screen.setAttribute("data-flemo-active", "false");
  screen.setAttribute("data-flemo-router", router);
  parent.appendChild(screen);
  return screen;
};

const push = (screen: Element) => {
  screen.setAttribute("data-flemo-status", "PUSHING");
  screen.setAttribute("data-flemo-active", "true");
};

const land = (screen: Element) => screen.setAttribute("data-flemo-status", "COMPLETED");

const fire = (target: Element, type: "animationcancel" | "animationend", name: string) => {
  const event = new Event(type, { bubbles: true }) as AnimationEvent;
  Object.defineProperty(event, "animationName", { value: name });
  Object.defineProperty(event, "elapsedTime", { value: 0 });
  target.dispatchEvent(event);
};

describe("a page with more than one Router", () => {
  it("records overlapping navigations of two Routers as two transitions", async () => {
    const page = mountScreen("page");
    // A demo Router nested inside the page's screen, as on a doc page.
    const demo = mountScreen("demo", page);
    handle = attachTransitionRecorder();
    await settle();

    push(demo);
    demo.setAttribute("data-flemo-anim-hold", "park-under");
    await settle();
    await frames(2);
    demo.setAttribute("data-flemo-anim-hold", "false");
    await settle();
    await frames(2);

    // The page turns while the demo is still moving, with its own hold.
    push(page);
    page.setAttribute("data-flemo-anim-hold", "park-under");
    await settle();
    fire(page, "animationcancel", "flemo-screen-doc-forward-PUSHING-true");
    await frames(2);

    land(demo);
    await settle();
    await frames(2);
    page.setAttribute("data-flemo-anim-hold", "false");
    land(page);
    await settle();
    await frames(3);

    const transitions = handle.report().transitions;
    expect(transitions.map((transition) => transition.routerId).sort()).toEqual(["demo", "page"]);
    const demoRecord = transitions.find((transition) => transition.routerId === "demo")!;
    const pageRecord = transitions.find((transition) => transition.routerId === "page")!;

    // Each counts only its own screen.
    expect(demoRecord.participants.screens).toBe(1);
    expect(pageRecord.participants.screens).toBe(1);
    // The page's hold is the page's, not a hold re-asserted on the demo.
    expect(demoRecord.motion.holdReassertedAtMs).toBeNull();
    expect(demoRecord.tripwires).toEqual([]);
    // The page's own animation event is filed under the page.
    expect(pageRecord.tripwires.map((hit) => hit.kind)).toEqual(["animation-cancel"]);
    // The demo closed when IT landed, not when the last Router did.
    expect(demoRecord.t1.ms).toBeLessThan(pageRecord.t1.ms);
  });

  it("still reports a hold re-asserted within one Router", async () => {
    const page = mountScreen("page");
    handle = attachTransitionRecorder();
    await settle();

    push(page);
    page.setAttribute("data-flemo-anim-hold", "park-under");
    await settle();
    page.setAttribute("data-flemo-anim-hold", "false");
    await settle();
    await frames(2);
    page.setAttribute("data-flemo-anim-hold", "park-under");
    await settle();
    page.setAttribute("data-flemo-anim-hold", "false");
    land(page);
    await settle();
    await frames(3);

    const [record] = handle.report().transitions;
    expect(record.motion.holdReassertedAtMs).not.toBeNull();
  });

  it("drops an animation event from a Router that is not moving", async () => {
    const page = mountScreen("page");
    const idle = mountScreen("idle");
    handle = attachTransitionRecorder();
    await settle();

    push(page);
    await settle();
    fire(idle, "animationend", "flemo-screen-cupertino-PUSHING-true");
    await frames(2);
    land(page);
    await settle();
    await frames(3);

    const [record] = handle.report().transitions;
    expect(record.tripwires).toEqual([]);
  });

  it("ignores what it cannot tie to a moving Router", async () => {
    const page = mountScreen("page");
    const idle = mountScreen("idle");
    handle = attachTransitionRecorder();
    await settle();

    push(page);
    await settle();
    // An animation event aimed at the document itself, which has no Router.
    fire(document as unknown as Element, "animationcancel", "flemo-screen-cupertino-PUSHING-true");
    // A morph role written on a Router that is not moving.
    const morph = document.createElement("div");
    idle.appendChild(morph);
    await settle();
    morph.setAttribute("data-flemo-morph", "travel");
    await settle();
    await frames(2);
    land(page);
    await settle();
    await frames(3);

    const [record] = handle.report().transitions;
    expect(record.routerId).toBe("page");
    expect(record.tripwires).toEqual([]);
    expect(record.morphs.moved).toEqual([]);
  });
});
