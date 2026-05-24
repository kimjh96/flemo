import { expect, test, type Page } from "@playwright/test";

// Wait for the screen scope marked `data-flemo-active="true"` to settle on a
// rest state (`COMPLETED` or `IDLE`). Every flemo transition flips status
// back to one of these when the keyframe ends, so it's the canonical
// "transition is done" signal — no time-based sleep.
async function waitForTransitionSettled(page: Page) {
  await expect(page.locator('[data-flemo-screen][data-flemo-active="true"]')).toHaveAttribute(
    "data-flemo-status",
    /COMPLETED|IDLE/
  );
}

test.describe("playground — navigation", () => {
  test("push: clicking an album tile reaches the Album screen and updates URL", async ({
    page
  }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    const firstAlbumTile = page.locator("button:has(.aspect-square)").first();
    const albumTitle = await firstAlbumTile.locator(".truncate").first().textContent();
    expect(albumTitle).toBeTruthy();

    await firstAlbumTile.click();

    // URL pattern: /album/{id}. Path is flemo-routed via pushState — the
    // landing page rewrote /playground → / on mount, so the Album push
    // lands at /album/{id} (no /playground prefix).
    await expect(page).toHaveURL(/\/album\/[^/]+$/);
    await waitForTransitionSettled(page);

    // Album title appears on the now-active Album screen. The Library
    // tile that triggered the navigation also carries the same string but
    // sits on the hidden, `data-flemo-active="false"` screen — scope the
    // search to the active screen so we don't latch onto the hidden one.
    const activeScreen = page.locator('[data-flemo-screen][data-flemo-active="true"]');
    await expect(activeScreen.getByText(albumTitle!, { exact: true }).first()).toBeVisible();

    // Two flemo screens are mounted now (Library kept underneath, Album on top).
    const screens = page.locator("[data-flemo-screen]");
    expect(await screens.count()).toBeGreaterThanOrEqual(2);
  });

  test("pop: back button on Album returns to Library", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.locator("button:has(.aspect-square)").first().click();
    await expect(page).toHaveURL(/\/album\/[^/]+$/);
    await waitForTransitionSettled(page);

    // AlbumAppBar back button — first button in the header with aria-label "Back".
    await page.getByRole("button", { name: "Back" }).click();

    // After pop, the URL is back at the Router root (`/`, possibly with the
    // segment query if the user had switched tabs first).
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await waitForTransitionSettled(page);

    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  });

  test("replace: switching the Library segment stays on `/` with the segment query", async ({
    page
  }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("button", { name: "Songs" }).click();
    await waitForTransitionSettled(page);

    // Library segment is a replace navigation — URL stays at the Router root
    // (`/?segment=songs`), no /album / /search push.
    await expect(page).toHaveURL(/\/\?segment=songs$/);
    await expect(page.locator('[data-flemo-screen][data-flemo-active="true"]')).toBeVisible();
  });

  test("tab nav: Search tab swaps screens via `breathe`", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("button", { name: "Search" }).click();
    await waitForTransitionSettled(page);

    await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
    // The active screen now declares breathe as its transition.
    await expect(page.locator('[data-flemo-screen][data-flemo-active="true"]')).toHaveAttribute(
      "data-flemo-transition",
      "breathe"
    );
  });
});
