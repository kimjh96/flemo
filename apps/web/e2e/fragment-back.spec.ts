import { expect, test } from "@playwright/test";

import { navButton, waitForNavIdle } from "./helpers/flemo";

// BACK ONTO AN IN-PAGE ANCHOR LANDS ON ITS SCREEN.
//
// A heading's `#anchor` link adds a history entry the browser creates by
// itself, with no state. Back from a screen pushed on top of it used to read
// that entry as foreign: the address bar moved to /docs/introduction#... and
// Home stayed on screen.

const shellHeading = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const screens = [
      ...document.querySelectorAll('[data-flemo-screen][data-flemo-active="true"]')
    ].filter((screen) => !screen.parentElement?.closest("[data-flemo-screen]"));
    return screens.at(-1)?.querySelector("h1")?.textContent?.trim() ?? "";
  });

test("Back from a pushed screen onto a heading anchor shows the page the anchor is on", async ({
  page
}) => {
  await page.goto("/docs/introduction");
  await waitForNavIdle(page);

  await page.locator("h2 a[href^='#']").first().click();
  await expect(page).toHaveURL(/\/docs\/introduction#/);

  await navButton(page, "Home").click();
  await expect(page).toHaveURL(/\/$/);
  await waitForNavIdle(page);
  expect(await shellHeading(page)).not.toBe("Introduction");

  await page.goBack();
  await expect(page).toHaveURL(/\/docs\/introduction#/);
  await waitForNavIdle(page);
  await expect.poll(() => shellHeading(page)).toBe("Introduction");

  // And Back again stays on the same page: the anchor was a place inside it.
  await page.goBack();
  await expect(page).toHaveURL(/\/docs\/introduction$/);
  await waitForNavIdle(page);
  await expect.poll(() => shellHeading(page)).toBe("Introduction");
});
