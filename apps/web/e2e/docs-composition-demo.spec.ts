import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// THE COMPOSITION DEMO KEEPS ITS MENU IN THE PHONE.
//
// The Putting it together demo is a whole app inside a docs page. Its menu is
// a Layer opened from the nested panel, and a Layer is hosted by the
// outermost screen, which here is the site's. The demo's app Router sets
// `ownsLayers`, so the menu lands in the demo's own host: above the demo's
// header, inside the device, and not over the site.

test("the panel's menu opens inside the demo, above its header", async ({ page }) => {
  await page.goto("/en/docs/composition");
  await waitForNavIdle(page);

  const demo = page.locator("figure").first();
  await demo.scrollIntoViewIfNeeded();
  await demo.getByRole("button", { name: "More" }).click();

  const menu = page.getByRole("dialog", { name: "Saved places" });
  await expect(menu).toBeVisible();

  const inside = await page.evaluate(() => {
    const dialog = document.querySelector("[role=dialog][aria-label='Saved places']");
    const figure = document.querySelector("figure");
    return Boolean(dialog && figure?.contains(dialog));
  });
  expect(inside).toBe(true);
});
