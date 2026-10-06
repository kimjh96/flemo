import { expect, test } from "@playwright/test";

// A DEMO ON A COVERED PAGE STOPS PLAYING.
//
// A doc page another page covers still intersects the viewport, so the
// IntersectionObserver gate kept its live demos autoplaying underneath. A page
// turn then froze a demo Router mid-transition until the reader came back, and
// the devtools recorder read that as a multi-second stall. The gate now also
// requires every flemo screen around the demo to be the active one.

test("no demo Router starts moving inside a page that is covered", async ({ page, isMobile }) => {
  await page.addInitScript(() => {
    const flags = window as unknown as { coveredStarts: number };
    flags.coveredStarts = 0;
    const seen = new Set<Element>();
    window.setInterval(() => {
      for (const screen of document.querySelectorAll("[data-flemo-screen]")) {
        const status = screen.getAttribute("data-flemo-status") ?? "";
        if (!["PUSHING", "POPPING", "REPLACING"].includes(status)) {
          seen.delete(screen);
          continue;
        }
        if (seen.has(screen)) continue;
        seen.add(screen);
        if (screen.parentElement?.closest('[data-flemo-screen][data-flemo-active="false"]')) {
          flags.coveredStarts += 1;
        }
      }
    }, 30);
  });

  await page.goto("/docs/morph");
  // Bring the live demo into view so it autoplays.
  await page.locator("figure").first().scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.querySelectorAll('figure [data-flemo-status="PUSHING"]').length > 0,
    null,
    { timeout: 10_000 }
  );

  // Cover the page while its demo is still in view: from the page list, which
  // is the phone's sheet or the wide screen's sidebar.
  if (isMobile) {
    await page.getByRole("button", { name: /Motion\s*Morph/ }).click();
    await page
      .getByTestId("docs-nav-sheet")
      .getByRole("button", { name: "Layer", exact: true })
      .click();
  } else {
    await page.getByRole("button", { name: "Layer", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/docs\/layer$/);
  // Longer than the demo's rest between moves, so a still-running autoplay
  // would have started another one under the new page.
  await page.waitForTimeout(5_000);

  expect(
    await page.evaluate(() => (window as unknown as { coveredStarts: number }).coveredStarts)
  ).toBe(0);
});
