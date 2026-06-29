import { expect, test } from "@playwright/test";

import { navButton, trackConsoleErrors } from "./helpers/flemo";

// flemo runs one navigation at a time: a push is ignored while the previous
// transition is still animating. Real users pause between taps; the tests let
// each transition complete before the next click (the longest shell transition
// is ~0.5s).
const SETTLE = 700;

test.describe("shell navigation", () => {
  // The header nav is desktop-only (hidden md:flex); mobile has no menu yet.
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, "desktop header nav only");

  test("header navigates between peers and highlights the active menu", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/");

    await expect(navButton(page, "Home")).toHaveAttribute("aria-current", "page");

    await navButton(page, "Showcase").click();
    await expect(navButton(page, "Showcase")).toHaveAttribute("aria-current", "page");
    await page.waitForTimeout(SETTLE);

    await navButton(page, "Playground").click();
    await expect(navButton(page, "Playground")).toHaveAttribute("aria-current", "page");
    await page.waitForTimeout(SETTLE);

    await navButton(page, "Docs").click();
    await expect(navButton(page, "Docs")).toHaveAttribute("aria-current", "page");

    expect(errors).toEqual([]);
  });

  // Regression: going back and forth between menus used to wedge the shared task
  // queue and freeze all navigation. Every hop must still take effect.
  test("repeated back-and-forth navigation never freezes", async ({ page }) => {
    await page.goto("/");

    const hops = [
      "Showcase",
      "Playground",
      "Docs",
      "Home",
      "Playground",
      "Showcase",
      "Home",
      "Docs"
    ];
    for (const label of hops) {
      await navButton(page, label).click();
      await expect(navButton(page, label)).toHaveAttribute("aria-current", "page", {
        timeout: 5000
      });
      await page.waitForTimeout(SETTLE);
    }
  });

  // Regression: re-clicking the current menu is a no-op, not a re-transition.
  test("active menu is idempotent", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/");

    await navButton(page, "Home").click();
    await navButton(page, "Home").click();
    await expect(navButton(page, "Home")).toHaveAttribute("aria-current", "page");

    expect(errors).toEqual([]);
  });
});
