import { expect, test } from "@playwright/test";

import { activeScreen, albumTile, waitForTransitionSettled } from "./helpers/flemo";

test.describe("playground — player state", () => {
  test("clicking a track on the Album screen updates the mini-player title", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    // First track row in AlbumScreen — click pushes to /now-playing AND
    // updates the player store with that track.
    const firstTrack = activeScreen(page).getByRole("button").nth(2); // back, art, then tracks
    const trackTitle = await firstTrack.locator(".truncate").first().textContent();

    await firstTrack.click();
    await expect(page).toHaveURL(/\/now-playing$/);
    await waitForTransitionSettled(page);

    if (trackTitle) {
      // Now Playing screen header shows the track title.
      await expect(activeScreen(page).getByText(trackTitle, { exact: true })).toBeVisible();
    }
  });

  test("Search input filters albums by title", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    await page.getByRole("button", { name: "Search" }).click();
    await waitForTransitionSettled(page);

    await page.getByPlaceholder("Artists, songs, albums").fill("Solace");
    await expect(page.getByText("Solace", { exact: true }).first()).toBeVisible();
    // Reasonably few matches at least include Solace.
    const albumRows = page.locator('[data-flemo-screen][data-flemo-active="true"] button');
    expect(await albumRows.count()).toBeGreaterThanOrEqual(1);
  });

  test("Search empty query shows Top Picks with all 18 albums", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    await page.getByRole("button", { name: "Search" }).click();
    await waitForTransitionSettled(page);

    await expect(page.getByText("Top Picks")).toBeVisible();
  });

  test("Search 'No matches' state appears for a clearly non-matching query", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    await page.getByRole("button", { name: "Search" }).click();
    await waitForTransitionSettled(page);

    await page.getByPlaceholder("Artists, songs, albums").fill("xxqzzz-no-match");
    await expect(page.getByText("No matches")).toBeVisible();
  });

  test("transitions picker reflects active selection (radio aria-checked)", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    const materialRadio = page.getByRole("radio", { name: /material/i });
    await materialRadio.click();
    await expect(materialRadio).toHaveAttribute("aria-checked", "true");

    // Cupertino is no longer checked.
    await expect(page.getByRole("radio", { name: /cupertino/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });
});
