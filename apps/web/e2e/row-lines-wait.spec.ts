import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// THE RETURNING ROW'S UNPAIRED LINES WAIT.
//
// On a pop back to the Tonight list, the row is staged in the morph layer and
// the ghost carrying the detail's content paints no surface of its own, so
// the row's venue line and price would show through it at full strength from
// the first frame. A stylesheet rule holds those lines back until the second
// half of the transition. It lives in the site's global.css, outside any
// component, so a rewrite of that file dropped it once without failing
// anything; this is what fails now.

test("a list pop keeps the row's venue and price hidden at its start", async ({ page }) => {
  await page.goto("/en/playground");
  await waitForNavIdle(page);

  const stage = page.locator("[data-playground-stage]");
  await stage.locator("button", { hasText: "Aria Wave" }).first().click();
  await waitForNavIdle(page);

  await page.evaluate(() => {
    const samples: number[][] = [];
    (window as unknown as { __rowLines: number[][] }).__rowLines = samples;
    const started = performance.now();
    const sample = () => {
      const lines = [...document.querySelectorAll("[data-flemo-morph-layer] .act-row-late")]
        .filter((line) => !line.closest("[data-flemo-morph-ghost]"))
        .map((line) => Number(getComputedStyle(line).opacity));
      if (lines.length > 0) samples.push(lines);
      if (performance.now() - started < 1200) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await stage.getByRole("button", { name: /back/i }).first().click();
  await waitForNavIdle(page);
  await page.waitForTimeout(300);

  const samples = await page.evaluate(
    () => (window as unknown as { __rowLines: number[][] }).__rowLines
  );
  expect(samples.length).toBeGreaterThan(0);
  // The first frames the row spends in the layer show none of its lines.
  for (const frame of samples.slice(0, 3)) {
    for (const opacity of frame) expect(opacity).toBeLessThan(0.05);
  }
});
