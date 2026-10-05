import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// A RELEASE IS THE ONLY ANIMATION ITS ELEMENT CARRIES.
//
// A swipe stages three animations per element: the drag (paused, `fill:
// both`) and the two legs a release can play. Releasing used to play one leg
// with the other two left attached on the same properties, and neither engine
// drew that leg as it should: Blink would not composite it and stepped the
// returning screen by whole pixels, and Safari kept drawing the paused drag
// pose, so the dim and the shared header's Parts froze for the whole release
// and cut at the end. Both were only ever visible on the glass; script reads
// the leg's values fine. What a real browser CAN be asked is the condition
// both failures came from, so that is what this pins.

const STAGE = "a, button, [role=tab]";

const openDetail = async (page: import("@playwright/test").Page) => {
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
  return page.evaluate(() => {
    const screen = [...document.querySelectorAll("[data-flemo-screen][data-flemo-router]")].find(
      (element) =>
        element.getAttribute("data-flemo-active") === "true" &&
        element.getAttribute("data-flemo-screen") !== "root"
    );
    if (!screen) return null;
    const rect = screen.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
};

for (const [label, reach] of [
  ["commit", 0.6],
  ["cancel", 0.15]
] as const) {
  test(`a ${label} release leaves one animation on each element it moves`, async ({ page }) => {
    const box = await openDetail(page);
    test.skip(box === null, "no pushed screen on this bench");
    const y = box!.y + box!.height * 0.6;
    await page.mouse.move(box!.x + 4, y);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) {
      await page.mouse.move(box!.x + 4 + box!.width * reach * (step / 12), y);
    }
    await page.mouse.up();
    // Mid-release: every element the gesture moved is moving its leg.
    await page.waitForTimeout(80);

    const counts = await page.evaluate(() => {
      const stage = document.querySelector("[data-playground-stage]")!;
      const moved = [
        ...stage.querySelectorAll<HTMLElement>("[data-flemo-screen], [data-flemo-decorator]")
      ];
      return moved.map((element) => element.getAnimations().length).filter((count) => count > 0);
    });

    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((count) => count === 1)).toBe(true);
  });
}
