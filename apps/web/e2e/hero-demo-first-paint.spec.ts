import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

test.describe("landing experience", () => {
  test("serves an interactive flemo app on the first paint", async ({ page, request }) => {
    const html = await (await request.get("/en")).text();
    expect(html).toContain("Make every screen feel connected.");
    expect(html).toContain("The experience");

    await page.goto("/en");
    const stage = page.locator('[data-playground-stage=""]');
    await expect(stage.getByRole("heading", { name: "Posters" })).toBeVisible();
    await stage.locator("li button").first().click();
    await expect(stage.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await stage.getByRole("button", { name: "Back" }).click();
    await waitForNavIdle(page);
    await expect(stage.getByRole("heading", { name: "Posters" })).toBeVisible();
  });

  test("the demo and primary actions fit a narrow viewport", async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width >= 768, "mobile viewport only");
    await page.goto("/en");
    await expect(page.getByRole("link", { name: "Try the live demo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport?.width ?? 375
    );
  });
});
