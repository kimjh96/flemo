import { expect, test } from "@playwright/test";

import { activeScreen, albumTile, allScreens, waitForTransitionSettled } from "./helpers/flemo";

test.describe("playground: navigation", () => {
  test("push: clicking an album tile reaches the Album screen and updates URL", async ({
    page
  }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    const firstTile = albumTile(page, 0);
    const albumTitle = await firstTile.locator(".truncate").first().textContent();
    expect(albumTitle).toBeTruthy();

    await firstTile.click();
    await expect(page).toHaveURL(/\/album\/[^/]+$/);
    await waitForTransitionSettled(page);

    await expect(activeScreen(page).getByText(albumTitle!, { exact: true }).first()).toBeVisible();
    expect(await allScreens(page).count()).toBeGreaterThanOrEqual(2);
  });

  test("pop: AlbumAppBar back button returns to Library", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await albumTile(page, 0).click();
    await expect(page).toHaveURL(/\/album\/[^/]+$/);
    await waitForTransitionSettled(page);

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await waitForTransitionSettled(page);

    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  });

  test("browser back: native popstate also pops the Album screen", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await waitForTransitionSettled(page);

    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  });

  test("browser forward: re-enters Album after a back", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await albumTile(page, 0).click();
    await expect(page).toHaveURL(/\/album\/[^/]+$/);
    await waitForTransitionSettled(page);
    const albumUrl = page.url();

    await page.goBack();
    await waitForTransitionSettled(page);

    await page.goForward();
    await expect(page).toHaveURL(albumUrl);
    await waitForTransitionSettled(page);

    await expect(activeScreen(page)).toBeVisible();
  });

  test("multi-push chain: Library → Album → NowPlaying via artwork", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await albumTile(page, 0).click();
    await expect(page).toHaveURL(/\/album\/[^/]+$/);
    await waitForTransitionSettled(page);

    // AlbumScreen renders a "Play <album>" button on the artwork that pushes
    // to /now-playing.
    await activeScreen(page)
      .getByRole("button", { name: /^Play / })
      .click();
    await expect(page).toHaveURL(/\/now-playing$/);
    await waitForTransitionSettled(page);

    await expect(page.getByText("Now Playing")).toBeVisible();
    expect(await allScreens(page).count()).toBeGreaterThanOrEqual(3);
  });

  test("replace: switching the Library segment stays on `/` with the segment query", async ({
    page
  }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("button", { name: "Songs" }).click();
    await waitForTransitionSettled(page);

    await expect(page).toHaveURL(/\/\?segment=songs$/);
    await expect(activeScreen(page)).toBeVisible();
  });

  test("tab nav: Search tab swaps screens via `breathe`", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("button", { name: "Search" }).click();
    await waitForTransitionSettled(page);

    await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "breathe");
  });

  test("tab nav round-trip: Library → Search → Library lands back on Library", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("button", { name: "Search" }).click();
    await waitForTransitionSettled(page);

    await page.getByRole("button", { name: "Library" }).click();
    await waitForTransitionSettled(page);

    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  });

  test("root: only one screen mounted at boot, no extras stick around", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    expect(await allScreens(page).count()).toBe(1);
  });
});
