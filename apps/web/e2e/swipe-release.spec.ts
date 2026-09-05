import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// WHERE THE SCREEN IS, NOT WHERE THE FINGER WENT.
//
// The release clock and the drag's reported progress were both read off
// `Math.abs(offset)` — the raw distance between the finger and where the drag
// began, sign discarded. That is the screen's travel only for a finger that
// never turns round, and a real one does: every handler clamps its screen at
// rest, so the moment the finger goes back past the start the screen stops
// while `|offset|` keeps growing.
//
// Measured here on this page, before the fix, at the instant the finger let go
// after being carried out and brought back:
//
//   the screen  translateX(0)   — home, exactly where it started
//   the dim     opacity 0.28    — as if the pop were 72% done
//   the settle  0.566s          — for a screen with the WHOLE width to cross
//
// and after it: opacity 1 and the authored 0.7s. Reported from a device as
// "the overlay does not follow the drag, and then it vanishes with no
// transition", after dragging left and right and letting go in the middle.
//
// A UNIT TEST CANNOT SEE THIS. The defect is the relationship between two
// elements' computed styles at one instant of a real gesture, so the net is
// here, driving a real pointer against the real compiled CSS.

const STAGE = "a, button, [role=tab]";

/** Open the cupertino bench and push its detail screen. */
const enterCupertinoDetail = async (page: import("@playwright/test").Page) => {
  await page.goto("/en/playground");
  await waitForNavIdle(page);
  await page.evaluate((selector) => {
    const control = [...document.querySelectorAll(selector)].find(
      (element) => (element.textContent ?? "").trim() === "cupertino"
    );
    (control as HTMLElement | undefined)?.click();
  }, STAGE);
  await page.waitForTimeout(500);
  await page.evaluate((selector) => {
    const card = [...document.querySelectorAll(selector)].find((element) =>
      /Aria Wave/.test(element.textContent ?? "")
    );
    (card as HTMLElement | undefined)?.click();
  }, STAGE);
  await waitForNavIdle(page);

  // The bench is a stage inside a page, not the viewport: the gesture has to
  // land inside the screen it is dragging.
  return page.evaluate(() => {
    const screens = [...document.querySelectorAll("[data-flemo-screen][data-flemo-router]")];
    const active = screens.find(
      (element) =>
        element.getAttribute("data-flemo-active") === "true" &&
        element.getAttribute("data-flemo-screen") !== "root"
    );
    if (!active) return null;
    const rect = active.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      id: active.getAttribute("data-flemo-screen") ?? ""
    };
  });
};

/** Sample the dragged screen and the dim it is revealing, once per frame. */
const startSampling = (page: import("@playwright/test").Page, id: string) =>
  page.evaluate((screenId) => {
    const store = window as unknown as { __flemoSwipeSamples?: unknown[] };
    store.__flemoSwipeSamples = [];
    const samples = store.__flemoSwipeSamples as {
      x: number | null;
      dim: number | null;
      transition: string;
    }[];
    const tick = () => {
      const screen = document.querySelector<HTMLElement>(`[data-flemo-screen="${screenId}"]`);
      // The dim being revealed belongs to the covered screen of the same
      // Router, which on this bench is its initial "root" screen.
      const dim = [...document.querySelectorAll<HTMLElement>("[data-flemo-decorator]")].find(
        (element) => element.getAttribute("data-flemo-decorator-owner") === "root"
      );
      samples.push({
        x: screen ? new DOMMatrixReadOnly(getComputedStyle(screen).transform).m41 : null,
        dim: dim ? Number(getComputedStyle(dim).opacity) : null,
        transition: screen?.style.transition ?? ""
      });
      (window as unknown as { __flemoSwipeRaf?: number }).__flemoSwipeRaf =
        requestAnimationFrame(tick);
    };
    tick();
  }, id);

const readSamples = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const raf = (window as unknown as { __flemoSwipeRaf?: number }).__flemoSwipeRaf;
    if (raf !== undefined) cancelAnimationFrame(raf);
    const samples = (window as unknown as { __flemoSwipeSamples: unknown[] })
      .__flemoSwipeSamples as { x: number | null; dim: number | null; transition: string }[];
    // Only frames where the screen was actually THERE on both samples: an
    // unmount reads as a jump to zero and is not motion. This measurement
    // artifact reported a 320px teleport on a perfectly smooth landing.
    const live = samples.filter((sample) => sample.x !== null) as {
      x: number;
      dim: number | null;
      transition: string;
    }[];
    let peakStep = 0;
    let movingFrames = 0;
    for (let index = 1; index < live.length; index += 1) {
      const step = Math.abs(live[index].x - live[index - 1].x);
      if (step > peakStep) peakStep = step;
      if (step > 0.5) movingFrames += 1;
    }
    const seconds = [
      ...new Set(
        samples
          .map((sample) => /([\d.]+)s/.exec(sample.transition)?.[1])
          .filter((value): value is string => value !== undefined)
      )
    ].map(Number);
    const travelled = live.length > 0 ? Math.abs(live[live.length - 1].x - live[0].x) : 0;
    return { peakStep, movingFrames, seconds, travelled, frames: live.length };
  });

test.describe("a swipe release continues the gesture", () => {
  test("the dim reads the screen, not the finger, when the drag comes back", async ({ page }) => {
    const stage = await enterCupertinoDetail(page);
    test.skip(stage === null, "no pushed screen on this bench");
    const box = stage!;
    await startSampling(page, box.id);

    const y = box.y + box.height / 2;
    const at = (dx: number) => page.mouse.move(Math.max(1, box.x + dx), y);

    // Start well inside the screen, carry it out, and bring the finger back
    // past where the drag began. Every handler clamps at rest, so the screen
    // is home — and everything the gesture drives has to agree with it.
    await at(box.width * 0.78);
    await page.mouse.down();
    for (let dx = box.width * 0.8; dx <= box.width * 0.94; dx += 10) {
      await at(dx);
      await page.waitForTimeout(16);
    }
    for (let dx = box.width * 0.94; dx >= 10; dx -= 20) {
      await at(dx);
      await page.waitForTimeout(16);
    }

    const atRest = await page.evaluate(() => {
      const samples = (
        window as unknown as { __flemoSwipeSamples: { x: number | null; dim: number | null }[] }
      ).__flemoSwipeSamples;
      return samples[samples.length - 1];
    });
    // The screen is home...
    expect(Math.abs(atRest.x ?? 0)).toBeLessThan(2);
    // ...so the dim over the screen underneath is still full. Before the fix
    // it read 0.28: the gesture had told it 72% of the pop was done.
    expect(atRest.dim ?? 0).toBeGreaterThan(0.9);

    await page.mouse.up();
    await page.waitForTimeout(1200);
  });

  test("a release from rest crosses the whole screen as motion", async ({ page }) => {
    const stage = await enterCupertinoDetail(page);
    test.skip(stage === null, "no pushed screen on this bench");
    const box = stage!;
    await startSampling(page, box.id);

    const y = box.y + box.height / 2;
    const at = (dx: number) => page.mouse.move(Math.max(1, box.x + dx), y);

    await at(box.width * 0.78);
    await page.mouse.down();
    for (let dx = box.width * 0.8; dx <= box.width * 0.94; dx += 10) {
      await at(dx);
      await page.waitForTimeout(16);
    }
    for (let dx = box.width * 0.94; dx >= 10; dx -= 20) {
      await at(dx);
      await page.waitForTimeout(16);
    }
    // A forward flick as it lets go, which is what commits the pop from here.
    await at(30);
    await page.waitForTimeout(16);
    await at(60);
    await page.mouse.up();
    await page.waitForTimeout(1400);

    const result = await readSamples(page);
    // The screen starts the landing at rest and finishes it off screen, and
    // every frame in between is one the eye can follow: no single frame
    // carries a quarter of the width, and there are many of them.
    //
    // The duration itself is deliberately NOT asserted here. A release
    // borrows the finger's speed by design, so its length moves with how the
    // pointer stream happened to be delivered — a threshold on it would be a
    // flake. What cannot move is that the screen has the WHOLE width in front
    // of it, which is what the shape below measures.
    expect(result.movingFrames).toBeGreaterThan(6);
    expect(result.peakStep).toBeLessThan(box.width / 4);
    expect(result.travelled).toBeGreaterThan(box.width * 0.9);
  });

  test("a fast flick lands as motion rather than as a cut", async ({ page }) => {
    const stage = await enterCupertinoDetail(page);
    test.skip(stage === null, "no pushed screen on this bench");
    const box = stage!;
    await startSampling(page, box.id);

    const y = box.y + box.height / 2;
    // No waits at all: the moves arrive as fast as the browser will deliver
    // them, which is what a coalesced pointer stream looks like.
    await page.mouse.move(box.x + 5, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, y);
    await page.mouse.move(box.x + box.width * 0.4, y);
    await page.mouse.up();
    await page.waitForTimeout(1400);

    const result = await readSamples(page);
    expect(result.movingFrames).toBeGreaterThan(4);
    // The landing may be quick; it may not be a cut.
    expect(result.peakStep).toBeLessThan(box.width / 3);
  });

  // AND ONCE WITH A FINGER.
  //
  // Everything above drives a mouse, and this repository has already shipped a
  // build whose touch path was broken outright while every automated layer
  // passed green: every probe used a pointer that gets no implicit capture and
  // never reaches the gesture machinery a phone does. This case exists to close
  // that hole, so it dispatches real touch events through CDP.
  //
  // WHAT IT PROVES AND WHAT IT DOES NOT. It proves the touch path drives a
  // drag, brings the screen home when the finger does, and lands as motion. It
  // is NOT the A/B for the dim: run against a build with the clamp removed,
  // this gesture still reads a full dim at rest, so unlike the mouse case above
  // it does not fail on the defect. Both assertions are true invariants and
  // both are kept; only the mouse case is evidence that the clamp is what makes
  // them true.
  //
  // THE MID-GESTURE ASSERTION IS NOT DECORATION. Without it, this case passed
  // in a context with no touch points at all: the events went nowhere, the
  // screen never moved, and "at rest with a full dim" was true for the wrong
  // reason. A probe that cannot fail is worse than no probe.
  test("the dim reads the screen under a real finger too", async ({ page, browserName }, info) => {
    test.skip(browserName !== "chromium", "touch dispatch goes through CDP");
    test.skip(info.project.use.hasTouch !== true, "needs a context with touch points");
    const stage = await enterCupertinoDetail(page);
    test.skip(stage === null, "no pushed screen on this bench");
    const box = stage!;
    await startSampling(page, box.id);

    const cdp = await page.context().newCDPSession(page);
    const y = box.y + box.height / 2;
    const finger = (type: "touchStart" | "touchMove" | "touchEnd", dx: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints:
          type === "touchEnd"
            ? []
            : [{ x: Math.max(1, box.x + dx), y, id: 1, radiusX: 12, radiusY: 12, force: 1 }]
      });
    const screenX = () =>
      page.evaluate((screenId) => {
        const screen = document.querySelector<HTMLElement>(`[data-flemo-screen="${screenId}"]`);
        return screen ? new DOMMatrixReadOnly(getComputedStyle(screen).transform).m41 : null;
      }, box.id);

    await finger("touchStart", box.width * 0.2);
    for (let dx = box.width * 0.25; dx <= box.width * 0.7; dx += 12) {
      await finger("touchMove", dx);
      await page.waitForTimeout(16);
    }

    // The finger is carrying the screen: without this the rest of the case can
    // pass on a build where nothing happened at all.
    expect(await screenX()).toBeGreaterThan(box.width * 0.2);

    for (let dx = box.width * 0.7; dx >= 10; dx -= 20) {
      await finger("touchMove", dx);
      await page.waitForTimeout(16);
    }

    const atRest = await page.evaluate(() => {
      const samples = (
        window as unknown as { __flemoSwipeSamples: { x: number | null; dim: number | null }[] }
      ).__flemoSwipeSamples;
      return samples[samples.length - 1];
    });
    // Back behind where it began, so the screen is home and the dim over the
    // screen underneath is still full. True on both sides of the fix here (see
    // the note above); the mouse case is the one that discriminates.
    expect(Math.abs(atRest.x ?? 0)).toBeLessThan(2);
    expect(atRest.dim ?? 0).toBeGreaterThan(0.9);

    await finger("touchEnd", 10);
    await page.waitForTimeout(1200);

    const result = await readSamples(page);
    expect(result.movingFrames).toBeGreaterThan(3);
    expect(result.peakStep).toBeLessThan(box.width / 4);
  });
});
