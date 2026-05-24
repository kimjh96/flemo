import { expect, test } from "@playwright/test";

test.describe("playground — smoke", () => {
  test("loads without console errors and renders the Library screen", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("/playground");

    // Wait for flemo to mount and settle at the root screen.
    const root = page.locator('[data-flemo-screen][data-flemo-active="true"]');
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute("data-flemo-status", /COMPLETED|IDLE/);

    // The Library screen header is the canonical landmark for `/`.
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();

    // Album tiles exist — the music demo seeds at least 6 albums.
    const albumTiles = page.locator("button:has(.aspect-square)");
    await expect(albumTiles.first()).toBeVisible();
    expect(await albumTiles.count()).toBeGreaterThanOrEqual(6);

    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  });
});
