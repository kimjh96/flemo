import { expect, test } from "@playwright/test";

import { activeScreen, albumTile, waitForTransitionSettled } from "./helpers/flemo";

test.describe("playground — transitions", () => {
  test("default push uses cupertino", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "cupertino");
  });

  test("material: pick from the toggle panel and the next push uses material", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("radio", { name: /material/i }).click();
    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "material");
  });

  test("blur (custom): pick from the toggle panel and the next push uses blur", async ({
    page
  }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("radio", { name: /blur/i }).click();
    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "blur");
  });

  test("zoom (custom): pick from the toggle panel and the next push uses zoom", async ({
    page
  }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("radio", { name: /zoom/i }).click();
    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "zoom");
  });

  test("card-stack (custom): pick from the toggle panel and the next push uses card-stack", async ({
    page
  }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("radio", { name: /card-stack/i }).click();
    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "card-stack");
  });

  test("reveal (custom): pick from the toggle panel and the next push uses reveal", async ({
    page
  }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("radio", { name: /reveal/i }).click();
    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "reveal");
  });

  test("spring (custom): pick from the toggle panel and the next push uses spring", async ({
    page
  }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("radio", { name: /spring/i }).click();
    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "spring");
  });

  test("none: instant swap, no keyframe phase visible", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("radio", { name: /^none/i }).click();
    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);

    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "none");
  });

  test("library segment forward uses slide-left", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("button", { name: "Songs" }).click();
    await waitForTransitionSettled(page);
    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "slide-left");
  });

  test("library segment backward uses slide-right", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await page.getByRole("button", { name: "Songs" }).click();
    await waitForTransitionSettled(page);
    await page.getByRole("button", { name: "Albums" }).click();
    await waitForTransitionSettled(page);
    await expect(activeScreen(page)).toHaveAttribute("data-flemo-transition", "slide-right");
  });
});
