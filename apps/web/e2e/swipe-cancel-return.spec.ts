import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// WHAT A CANCELLED SWIPE LOOKS LIKE, which is the half no unit test can see.
//
// A drag that stops short has to put everything back the way the transition
// says: the screens, the chrome that rides them, and the shared element in the
// air. It used to put them back in a straight line — the release replayed the
// scrub backwards, and the scrub inverts the curve, so a cancel always came
// home through the curve's opening, which is its own tangent. Device-reported
// as a screen that "just snaps back with no transition".
//
// Two things are watched here, and neither can be asked of jsdom: that the
// return is staged from what the flight actually compiled (a browser is what
// answers `getKeyframes`, and Chromium answers a CSS animation without its
// custom properties, which is a morph's whole travel), and that the motion on
// glass decelerates rather than running at a constant speed.
const STAGE = "a, button, [role=tab]";

/** Open a bench case by the name on its control and push the detail screen. */
const enterCase = async (page: import("@playwright/test").Page, name: string) => {
  await page.goto("/en/playground");
  await waitForNavIdle(page);
  await page.evaluate(
    ({ selector, label }) => {
      const control = [...document.querySelectorAll(selector)].find(
        (element) => (element.textContent ?? "").trim() === label
      );
      (control as HTMLElement | undefined)?.click();
    },
    { selector: STAGE, label: name }
  );
  await page.waitForTimeout(500);
  await page.evaluate((selector) => {
    const card = [...document.querySelectorAll(selector)].find((element) =>
      /Aria Wave/.test(element.textContent ?? "")
    );
    (card as HTMLElement | undefined)?.click();
  }, STAGE);
  await waitForNavIdle(page);

  return page.evaluate(() => {
    const active = [...document.querySelectorAll("[data-flemo-screen][data-flemo-router]")].find(
      (element) =>
        element.getAttribute("data-flemo-active") === "true" &&
        element.getAttribute("data-flemo-screen") !== "root"
    );
    if (!active) return null;
    const rect = active.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
};

/**
 * Drag an eighth of the way across and come to rest there.
 *
 * Short of the distance a commit takes, and still by the time the finger
 * lifts, so the release is a cancel on both counts flemo reads.
 */
const dragAndHold = async (
  page: import("@playwright/test").Page,
  box: { x: number; y: number; width: number; height: number }
) => {
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 5, y);
  await page.mouse.down();
  for (const fraction of [0.04, 0.08, 0.12]) {
    await page.mouse.move(box.x + box.width * fraction, y, { steps: 4 });
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(260);
};

test.describe("a cancelled swipe", () => {
  test("stages the return of the flight it is holding", async ({ page }) => {
    const box = await enterCase(page, "cupertino");
    test.skip(box === null, "no pushed screen on this bench");
    await dragAndHold(page, box!);

    const staged = await page.evaluate(() => {
      // A compiled animation carries the name it was compiled under; one the
      // gesture staged through `element.animate` has no name at all.
      const flying = new Set<Element>();
      let compiled = 0;
      for (const animation of document.getAnimations()) {
        const name = (animation as unknown as { animationName?: unknown }).animationName;
        const target = (animation.effect as KeyframeEffect | null)?.target ?? null;
        if (typeof name !== "string" || !name.startsWith("flemo-morph-")) continue;
        compiled++;
        if (target) flying.add(target);
      }
      let returns = 0;
      for (const animation of document.getAnimations()) {
        const name = (animation as unknown as { animationName?: unknown }).animationName;
        const target = (animation.effect as KeyframeEffect | null)?.target ?? null;
        if (typeof name !== "string" && target && flying.has(target)) returns++;
      }
      return { compiled, returns };
    });

    expect(staged.compiled).toBeGreaterThan(0);
    // Staged WITH the drag, so the frame the finger lifts has no animation to
    // commit. A zero here is the sheet read failing silently, which leaves the
    // flight on the straight-line hand-back it used to have.
    expect(staged.returns).toBeGreaterThan(0);

    await page.mouse.up();
  });

  test("comes home on the curve rather than at a constant speed", async ({ page }) => {
    const box = await enterCase(page, "cupertino");
    test.skip(box === null, "no pushed screen on this bench");
    await dragAndHold(page, box!);

    await page.evaluate(() => {
      const trace: number[] = [];
      (window as unknown as { __return: number[] }).__return = trace;
      const read = () => {
        const screen = [...document.querySelectorAll("[data-flemo-screen]")].find(
          (element) =>
            element.getAttribute("data-flemo-active") === "true" &&
            element.getAttribute("data-flemo-screen") !== "root"
        );
        if (screen) {
          const style = getComputedStyle(screen);
          trace.push(
            new DOMMatrixReadOnly(style.transform).m41 + (Number.parseFloat(style.translate) || 0)
          );
        }
        if (trace.length < 40) requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    await page.mouse.up();
    await page.waitForTimeout(900);

    const trace = await page.evaluate(() => (window as unknown as { __return: number[] }).__return);
    // It went somewhere, and it came back: a release that committed would have
    // left instead, and would be measuring something else entirely.
    expect(trace[0]).toBeGreaterThan(4);
    expect(Math.abs(trace[trace.length - 1]!)).toBeLessThan(1);

    // MEASURED AGAINST THE TRACE'S OWN CLOCK, NOT FRAME BY FRAME.
    //
    // A dropped frame carries two frames' worth of travel, so a loaded machine
    // can make a decelerating return non-monotone frame by frame while the
    // motion itself is perfectly smooth. It cost this file a red CI run. What
    // does not move when a frame does is WHERE ALONG THE RETURN the distance
    // was spent.
    const steps = trace.slice(1).map((value, index) => Math.abs(value - trace[index]!));
    const first = steps.findIndex((step) => step > 0.05);
    const last = steps.reduce((found, step, index) => (step > 0.005 ? index : found), -1);
    expect(first).toBeGreaterThanOrEqual(0);
    const home = steps.slice(first, last + 1);
    expect(home.length).toBeGreaterThan(4);

    const total = home.reduce((sum, step) => sum + step, 0);
    let carried = 0;
    let halfway = home.length;
    for (const [index, step] of home.entries()) {
      carried += step;
      if (carried >= total / 2) {
        halfway = index + 1;
        break;
      }
    }
    // The author's curve leaves fast and lands flat, so half the way home is
    // covered in the first fraction of the return. A straight line, which is
    // what a cancel used to run, spends half its distance at the halfway mark.
    expect(halfway / home.length).toBeLessThan(0.3);

    // ...and it is slowing throughout: each third of the return covers less
    // than the third before it.
    const third = Math.max(1, Math.floor(home.length / 3));
    const spent = (from: number, to: number) =>
      home.slice(from, to).reduce((sum: number, step: number) => sum + step, 0);
    expect(spent(0, third)).toBeGreaterThan(spent(third, third * 2));
    expect(spent(third, third * 2)).toBeGreaterThanOrEqual(spent(third * 2, home.length));
  });
});
