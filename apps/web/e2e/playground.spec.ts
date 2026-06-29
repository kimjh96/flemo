import { expect, test } from "@playwright/test";

import { trackConsoleErrors } from "./helpers/flemo";

const TRANSITIONS = [
  "Cupertino",
  "Material",
  "Blur",
  "Reveal",
  "Dive",
  "Ripple",
  "Card stack",
  "Spring",
  "Fade",
  "Zoom"
];

test.describe("playground", () => {
  test("Next advances the panel and Back returns", async ({ page }) => {
    await page.goto("/playground");

    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("2", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
  });

  // The nested browser Router reflects its seed path, so the first panel's id
  // shows in the URL (not the bare /playground).
  test("the initial panel reflects its id in the URL", async ({ page }) => {
    await page.goto("/playground");
    await expect(page).toHaveURL(/\/playground\/1$/);
  });

  // "View source" dogfoods useStep: it opens as a history step (a code param),
  // and the browser Back button closes it without leaving the playground.
  test("View source opens a code step that browser back closes", async ({ page }) => {
    await page.goto("/playground");
    await page.getByRole("button", { name: "Blur", exact: true }).click();

    await page.getByRole("button", { name: "View source" }).click();
    await expect(page).toHaveURL(/code=blur/);

    await page.goBack();
    await expect(page).not.toHaveURL(/code=/);
    await expect(page).toHaveURL(/\/playground\/1$/);
  });

  // Regression: a step pop in the keyed nested Router must restore the panel's
  // params, so closing the source on panel 3 returns to panel 3 (not panel 1).
  // Deep-link straight to panel 3 so a single screen is mounted.
  test("the source panel preserves the current panel on close", async ({ page }) => {
    await page.goto("/playground/3");
    await expect(page.getByTestId("lab-panel-number")).toHaveText("3");

    await page.getByRole("button", { name: "View source" }).click();
    await expect(page).toHaveURL(/\/playground\/3\?code=/);

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page).toHaveURL(/\/playground\/3$/);
    await expect(page.getByTestId("lab-panel-number")).toHaveText("3");
  });

  // Every transition (built-ins + the authored ones, dive/ripple carry
  // decorators) drives a Next without throwing or wedging the queue.
  test("every transition runs without errors", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");

    for (const transition of TRANSITIONS) {
      await page.getByRole("button", { name: transition, exact: true }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.waitForTimeout(650);
    }

    expect(errors).toEqual([]);
  });
});
