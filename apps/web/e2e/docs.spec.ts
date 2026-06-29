import { expect, test } from "@playwright/test";

import { trackConsoleErrors } from "./helpers/flemo";

test.describe("docs", () => {
  // The docs sidebar is desktop-only (hidden md:block).
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, "desktop sidebar only");

  test("sidebar navigates between pages and reflects the URL", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/docs");

    await expect(page.getByRole("heading", { name: "Introduction", level: 1 })).toBeVisible();

    await page.locator("aside").getByRole("button", { name: "Router and Route" }).click();
    await expect(page.getByRole("heading", { name: "Router and Route", level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/docs\/router$/);

    expect(errors).toEqual([]);
  });

  // The composed paths are real URLs now, so browser back walks the history.
  test("browser back returns to the previous doc page", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.getByRole("heading", { name: "Introduction", level: 1 })).toBeVisible();

    await page.locator("aside").getByRole("button", { name: "Router and Route" }).click();
    await expect(page.getByRole("heading", { name: "Router and Route", level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/docs\/router$/);

    await page.goBack();
    await expect(page.getByRole("heading", { name: "Introduction", level: 1 })).toBeVisible();
  });

  // Deep-link / refresh: the composed path is a real server route (200, no 404).
  test("deep-links straight to a sub-page", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/docs/transitions");

    await expect(page.getByRole("heading", { name: "Transitions", level: 1 })).toBeVisible();

    expect(errors).toEqual([]);
  });

  // The language toggle switches in place: same doc page, no navigation away.
  test("language toggle switches language without leaving the page", async ({ page }) => {
    await page.goto("/docs");
    await page.locator("aside").getByRole("button", { name: "Router and Route" }).click();
    await expect(page).toHaveURL(/\/docs\/router$/);

    await page.locator("header").getByRole("button", { name: "한국어" }).click();

    await expect(page).toHaveURL(/\/docs\/router$/);
    await expect(page.getByRole("heading", { name: "Router와 Route", level: 1 })).toBeVisible();
  });
});
