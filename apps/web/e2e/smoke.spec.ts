import { expect, test } from "@playwright/test";

import { siteHeader, trackConsoleErrors } from "./helpers/flemo";

// Each promoted shell route renders its first paint with no JS console errors.
const ROUTES = ["/", "/showcase", "/playground", "/docs"];

test.describe("smoke", () => {
  for (const route of ROUTES) {
    test(`${route} renders without console errors`, async ({ page }) => {
      const { errors } = trackConsoleErrors(page);
      await page.goto(route);
      await expect(siteHeader(page)).toBeVisible();
      // Give nested demos a beat to mount and run their first frame.
      await page.waitForTimeout(800);
      expect(errors).toEqual([]);
    });
  }
});
