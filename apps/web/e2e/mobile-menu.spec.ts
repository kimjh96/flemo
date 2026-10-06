import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// THE MOBILE MENU MOVES, AS THE SEARCH DOES.
//
// It was already a step (`?menu=true`), but it cut in and out. It now drops
// into place and closes faster than it opens, staying mounted through the
// close. Escape closes it, and with the search open over it the search takes
// the first Escape on its own.

test.skip(({ isMobile }) => !isMobile, "the menu button is phone-only");

const panel = (page: import("@playwright/test").Page) => page.locator("header > div[data-state]");

const panelAnimations = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    (document.querySelector("header > div[data-state]")?.getAnimations() ?? []).map(
      (animation) => (animation as CSSAnimation).animationName
    )
  );

test("opens and closes with motion, and Back closes it", async ({ page }) => {
  await page.goto("/");
  await waitForNavIdle(page);

  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page).toHaveURL(/\?menu=true$/);
  await expect(panel(page)).toHaveAttribute("data-state", "open");
  expect(await panelAnimations(page)).toContain("menu-panel-in");

  await page.goBack();
  await expect(panel(page)).toHaveAttribute("data-state", "closed");
  expect(await panelAnimations(page)).toContain("menu-panel-out");
  await expect(panel(page)).toHaveCount(0);
});

test("Escape closes the search over the menu first, then the menu", async ({ page }) => {
  await page.goto("/");
  await waitForNavIdle(page);

  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page).toHaveURL(/\?menu=true$/);
  await page.keyboard.press("Control+k");
  await expect(page).toHaveURL(/\?search=true$/);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\?menu=true$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(panel(page)).toHaveAttribute("data-state", "open");

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(panel(page)).toHaveCount(0);
});
