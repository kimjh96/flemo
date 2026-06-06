import { expect, test } from "@playwright/test";

import {
  activeScreen,
  albumTile,
  trackConsoleErrors,
  waitForTransitionSettled
} from "./helpers/flemo";

test.describe("playground: smoke", () => {
  test("loads without console errors and renders the Library screen", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);

    await page.goto("/playground");

    const root = activeScreen(page);
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute("data-flemo-status", /COMPLETED|IDLE/);

    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();

    // 18 albums seeded.
    await expect(albumTile(page, 0)).toBeVisible();
    expect(await page.locator("button:has(.aspect-square)").count()).toBeGreaterThanOrEqual(18);

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("standalone view shows the toggle panel beside the phone frame", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    await expect(
      page.getByRole("heading", { name: "Compose transitions per navigation" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pin bars across screens" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What flemo is doing, right now" })
    ).toBeVisible();
  });

  test("library segment bar exposes all three segments", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    for (const label of ["Albums", "Songs", "Artists"]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("tab bar exposes Library + Search", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    await expect(page.getByRole("button", { name: "Library" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });
});
