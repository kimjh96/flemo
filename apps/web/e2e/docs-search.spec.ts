import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// THE SEARCH DIALOG IS A STEP, AND IT MOVES.
//
// It used to be a bare boolean: it cut in and out with no motion, and the
// browser's Back left the page under it instead of closing it. Open is now a
// flemo step (`?search=true`), so Back closes it, and both ways run an
// animation the dialog stays mounted through.

const dialog = (page: import("@playwright/test").Page) => page.getByRole("dialog");

const runningAnimations = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    (document.querySelector('[role="dialog"]')?.getAnimations() ?? []).map(
      (animation) => (animation as CSSAnimation).animationName
    )
  );

test("opens with motion as a step, and Back closes it with motion", async ({ page }) => {
  await page.goto("/docs/introduction");
  await waitForNavIdle(page);

  await page.keyboard.press("Control+k");
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(/\/docs\/introduction\?search=true$/);
  expect(await runningAnimations(page)).toContain("search-panel-in");
  await expect(page.getByPlaceholder(/search/i)).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(/\/docs\/introduction$/);
  // Still on screen for its close, then gone.
  await expect(dialog(page)).toHaveAttribute("data-state", "closed");
  expect(await runningAnimations(page)).toContain("search-panel-out");
  await expect(dialog(page)).toHaveCount(0);
});

test("Escape closes the step without leaving the page", async ({ page }) => {
  await page.goto("/docs/introduction");
  await waitForNavIdle(page);

  await page.keyboard.press("Control+k");
  await expect(page).toHaveURL(/\?search=true$/);
  // From anywhere, not only from the input.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/docs\/introduction$/);
  await expect(dialog(page)).toHaveCount(0);
});

test("a chosen result leaves no search step behind it", async ({ page }) => {
  await page.goto("/docs/introduction");
  await waitForNavIdle(page);

  await page.keyboard.press("Control+k");
  await expect(page.getByPlaceholder(/search/i)).toBeFocused();
  await page.keyboard.type("Morph");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/morph$/);
  await waitForNavIdle(page);

  // Back returns to the page the search was opened on, not to the open dialog.
  await page.goBack();
  await expect(page).toHaveURL(/\/docs\/introduction$/);
  await waitForNavIdle(page);
  await expect(dialog(page)).toHaveCount(0);
});
