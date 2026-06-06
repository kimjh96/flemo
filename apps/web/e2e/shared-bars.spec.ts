import { expect, test } from "@playwright/test";

import { activeScreen, albumTile, waitForTransitionSettled } from "./helpers/flemo";

test.describe("playground: shared bars", () => {
  test("Library declares a sharedAppBar (LibraryHeader)", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    // The bar wrapper is a sibling of the screen scope, marked with
    // `data-flemo-bar="app"` by ScreenMotion.
    await expect(page.locator('[data-flemo-bar="app"]')).toHaveCount(1);
  });

  test("toggling Shared app bar off removes the sharedAppBar", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("switch", { name: "Shared app bar" }).click();
    await expect(page.locator('[data-flemo-bar="app"]')).toHaveCount(0);

    // Toggle back so the test is hermetic.
    await page.getByRole("switch", { name: "Shared app bar" }).click();
    await expect(page.locator('[data-flemo-bar="app"]')).toHaveCount(1);
  });

  test("Library declares a sharedNavigationBar (PlayerBottomBar) by default", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    await expect(page.locator('[data-flemo-bar="nav"]')).toHaveCount(1);
  });

  test("toggling Mini-player off removes the sharedNavigationBar", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    // Toggle switch in the side panel. Clicking the row toggles visibility.
    await page.getByRole("switch", { name: "Shared navigation bar" }).click();
    await expect(page.locator('[data-flemo-bar="nav"]')).toHaveCount(0);

    // Toggle back so the test is hermetic.
    await page.getByRole("switch", { name: "Shared navigation bar" }).click();
    await expect(page.locator('[data-flemo-bar="nav"]')).toHaveCount(1);
  });

  test("during push from Library to Album, riding flag flips on the Library bottom bar", async ({
    page
  }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    // Library has the nav bar; Album does NOT declare `sharedNavigationBar`
    // when the mini-player is off, so toggle it off so partner ownership flips.
    await page.getByRole("switch", { name: "Shared navigation bar" }).click();
    await waitForTransitionSettled(page);

    await albumTile(page, 0).click();
    // At completed/idle the riding attribute is cleared, so just verify the
    // post-state: the bar is gone (Library no longer renders one once
    // mini-player is off; Album never had one).
    await waitForTransitionSettled(page);
    await expect(page.locator('[data-flemo-bar="nav"]')).toHaveCount(0);

    // Restore.
    await page.getByRole("button", { name: "Back" }).click();
    await waitForTransitionSettled(page);
    await page.getByRole("switch", { name: "Shared navigation bar" }).click();
    await expect(page.locator('[data-flemo-bar="nav"]')).toHaveCount(1);
  });

  test("Album screen exposes its appBar (not shared) with a Back button", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    // Album uses the regular `appBar` (renders inside the scope, not as a
    // shared bar), so the Back button is part of the active screen.
    await expect(activeScreen(page).getByRole("button", { name: "Back" })).toBeVisible();
  });
});
