import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// The layering rule, driven rather than described. A screen that moves carries
// a transform, which makes it a containing block for `position: fixed`
// descendants and a stacking context around all of them; the shared bars sit
// outside it. So a sheet authored in the screen cannot be interleaved with the
// bar, and <Layer> is what takes it out.
//
// jsdom sees none of this — it does no layout and no paint — so the unit tests
// beside <Layer> can only pin where the DOM lands. What the sheet actually
// COVERS is a browser question, and this is the only place the repository asks
// it.

const stage = "[data-layer-stage]";

async function openSheet(page: import("@playwright/test").Page, hosted: boolean) {
  const toggle = page.locator("[data-layer-toggle]");
  if ((await toggle.isChecked()) !== hosted) await toggle.setChecked(hosted);
  await page.locator("[data-layer-open]").click();
  await expect(page.locator("[data-layer-sheet]")).toBeVisible();
}

// Who paints at the centre of the tab bar: the sheet, the bar, or neither.
async function atTheBar(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const bar = document.querySelector("[data-layer-bar]");
    const sheet = document.querySelector("[data-layer-sheet]");
    if (!bar || !sheet) return { verdict: "missing" as const, sheetBottom: 0, stageBottom: 0 };

    const box = bar.getBoundingClientRect();
    const stack = document.elementsFromPoint(
      Math.round(box.left + box.width / 2),
      Math.round(box.top + box.height / 2)
    );
    const sheetIndex = stack.findIndex((element) => sheet.contains(element));
    const barIndex = stack.findIndex((element) => bar.contains(element));

    return {
      verdict:
        sheetIndex < 0 || barIndex < 0
          ? ("neither" as const)
          : sheetIndex < barIndex
            ? ("sheet" as const)
            : ("bar" as const),
      sheetBottom: Math.round(sheet.getBoundingClientRect().bottom),
      stageBottom: Math.round(
        document.querySelector("[data-layer-stage]")!.getBoundingClientRect().bottom
      )
    };
  });
}

test.describe("overlay layering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/playground");
    await page.locator(stage).scrollIntoViewIfNeeded();
    await waitForNavIdle(page);
  });

  test("a hosted sheet reaches the floor and covers the shared bar", async ({ page }) => {
    await openSheet(page, true);

    const result = await atTheBar(page);
    expect(result.verdict).toBe("sheet");
    // Hosted, so nothing between it and the viewport is a containing block and
    // it reaches the floor — within the frame's own 1px border.
    expect(result.stageBottom - result.sheetBottom).toBeLessThanOrEqual(2);
  });

  test("a sheet written in the screen is confined by the screen", async ({ page }) => {
    await openSheet(page, false);

    const result = await atTheBar(page);
    // The containment on the screen is doing its job: the sheet stops at the
    // screen box, which ends above the bar, and the bar paints over it.
    expect(result.verdict).toBe("bar");
    expect(result.sheetBottom).toBeLessThan(result.stageBottom);
  });

  test("a hosted sheet keeps covering the bar while a screen is in flight", async ({ page }) => {
    await openSheet(page, true);

    await page.locator("[data-layer-push]").click();
    // Sample DURING the flight: this is the window a resting assertion cannot
    // see, and the one the rule is actually about.
    await page.waitForFunction(() =>
      document.querySelector('[data-flemo-screen][data-flemo-status="PUSHING"]')
    );

    const result = await atTheBar(page);
    expect(result.verdict).toBe("sheet");

    await waitForNavIdle(page);
  });
});
