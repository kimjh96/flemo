import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// A TRANSITION WITH NO CLOCK STILL CARRIES ITS SHARED ELEMENT.
//
// `none` is an instant replace, and an author who paired a `<Morph>` with it
// wanted the element to fly and the screens not to. The push always did. The
// POP did not: the departing screen is taken out inside the frame it was held
// in, and the layer mirroring that hold kept the flight paused at time zero
// for its whole length before cutting the element home. Every transition with
// a clock hid it, because a screen with a clock outlives its own release.
//
// Watched as travel rather than as attributes: the defect left the flight
// staged, named and animated, and every one of those read correct.
const STAGE = "a, button, [role=tab]";

/** The flying element's box, sampled for the length of a flight. */
const travel = async (page: import("@playwright/test").Page, act: () => Promise<void>) => {
  await page.evaluate(() => {
    const sizes: number[] = [];
    (window as unknown as { __t: number[] }).__t = sizes;
    const read = () => {
      const flying = document.querySelector('[data-flemo-morph="enter"]');
      if (flying) sizes.push(Math.round(flying.getBoundingClientRect().width));
      if (sizes.length < 40) requestAnimationFrame(read);
    };
    requestAnimationFrame(read);
  });
  await act();
  await page.waitForTimeout(900);
  return page.evaluate(() => (window as unknown as { __t: number[] }).__t);
};

test.describe("a morph under the none transition", () => {
  test("flies in both directions, not just on the way in", async ({ page }) => {
    await page.goto("/en/playground");
    await waitForNavIdle(page);
    await page.evaluate((selector) => {
      const control = [...document.querySelectorAll(selector)].find(
        (element) => (element.textContent ?? "").trim() === "none"
      );
      (control as HTMLElement | undefined)?.click();
    }, STAGE);
    await page.waitForTimeout(500);

    const pushed = await travel(page, async () => {
      await page.evaluate((selector) => {
        const card = [...document.querySelectorAll(selector)].find((element) =>
          /Aria Wave/.test(element.textContent ?? "")
        );
        (card as HTMLElement | undefined)?.click();
      }, STAGE);
    });
    // It grew, and it did so over frames rather than in one step.
    expect(pushed.length).toBeGreaterThan(4);
    expect(Math.max(...pushed)).toBeGreaterThan(Math.min(...pushed) * 2);
    expect(new Set(pushed).size).toBeGreaterThan(4);

    const popped = await travel(page, async () => {
      await page.evaluate(() => {
        const back = [...document.querySelectorAll("button")].find((node) =>
          /back|뒤로/i.test(node.getAttribute("aria-label") ?? "")
        );
        (back as HTMLElement | undefined)?.click();
      });
    });
    expect(popped.length).toBeGreaterThan(4);
    // The same journey, the other way. A held flight reports one size for
    // every frame it is stuck at, which is what this counts.
    expect(Math.max(...popped)).toBeGreaterThan(Math.min(...popped) * 2);
    expect(new Set(popped).size).toBeGreaterThan(4);
  });
});
