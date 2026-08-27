import { expect, test, type Page } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// `<Layer>`, guarded against the real app rather than a purpose-built harness.
//
// This is a REWRITE, not a restore. The suite it replaces drove a dedicated
// `/playground/layer` route — a magenta sheet over a fluorescent bar, with
// frozen pixel geometry — and measured that. The route is gone because it was
// unreadable to anyone who had not written it. The invariants survive; the
// measurements are now the app's own layout, so they are stated in relative
// terms and never in pinned pixels.
//
// What is being guarded is one sentence from `Layer.tsx`:
//
//   "At rest none of this is needed ... `<Layer>` is for the overlay that has
//    to survive the screen MOVING under it."
//
// So the honest half of the story is asserted too: at rest the two placements
// are indistinguishable. A suite where the hosted case passes and the inline
// case also passes has stopped measuring anything.
const SHEET = "[data-booking-sheet]";
const TAB_BAR = "[data-playground-stage] nav";

async function openPlayground(page: Page) {
  await page.goto("/playground");
  await waitForNavIdle(page);
}

async function setPlacement(page: Page, mode: "hosted" | "inline") {
  const control = page.locator(`[data-overlay-mode="${mode}"]`);
  await control.scrollIntoViewIfNeeded();
  await control.click();
  await expect(control).toHaveAttribute("aria-checked", "true");
}

async function openSheet(page: Page) {
  await page.locator("[data-open-sheet]").click();
  await expect(page.locator(SHEET)).toBeVisible();
  await waitForNavIdle(page);
}

// Who paints at the middle of the tab bar — the sheet, the bar, or neither.
// Read at the bar's own centre so a "sheet" verdict means what the eye reports.
async function atTheBar(page: Page) {
  return page.evaluate(
    ([barSelector, sheetSelector]) => {
      const bar = document.querySelector(barSelector!);
      const sheet = document.querySelector(sheetSelector!);
      if (!bar || !sheet) return { verdict: "missing" as const, left: 0 };

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
        // Where the sheet's own box is, so "did it travel with its screen"
        // is answerable. A hosted slot rides the screen; a trapped one does
        // not move at all.
        left: Math.round(sheet.getBoundingClientRect().left)
      };
    },
    [TAB_BAR, SHEET]
  );
}

// Wait until the screen that OWNS the sheet has actually moved.
//
// Sampling on the status flip alone measures nothing: at t=0 the screen is
// still at its start pose, so a sheet that travels and a sheet that is pinned
// read identically. The engine also absorbs heavy commits into the hold before
// any visible motion, so the flip is not the start of movement either. Poll the
// departing screen's transform instead.
async function waitForDeparture(page: Page, minimumPx = 40) {
  await page.waitForFunction(
    (minimum) => {
      const owner = document
        .querySelector("[data-open-sheet]")
        ?.closest("[data-flemo-screen]") as HTMLElement | null;
      if (!owner) return false;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(owner).transform);
      return Math.abs(matrix.m41) >= minimum || Math.abs(matrix.m42) >= minimum;
    },
    minimumPx,
    { polling: "raf" }
  );
}

test.describe("overlay layering", () => {
  test.beforeEach(async ({ page }) => {
    await openPlayground(page);
  });

  test("at rest both placements clear the tab bar", async ({ page }) => {
    // The honest half. A screen at rest carries no transform, so a consumer's
    // `position: fixed` sheet already resolves against the viewport and already
    // outranks the bar. If this ever fails for the inline case, the difference
    // the other tests measure has stopped being attributable to `<Layer>`.
    for (const mode of ["hosted", "inline"] as const) {
      await setPlacement(page, mode);
      await openSheet(page);

      expect((await atTheBar(page)).verdict, `${mode} at rest`).toBe("sheet");

      await page.locator("[data-booking-sheet-close]").click();
      await waitForNavIdle(page);
    }
  });

  test("a hosted sheet travels with its screen and keeps covering the bar", async ({ page }) => {
    await setPlacement(page, "hosted");
    await openSheet(page);

    const atRest = await atTheBar(page);

    await page.locator("[data-playground-stage] button:has-text('Aria Wave')").click();
    await waitForDeparture(page);

    const inFlight = await atTheBar(page);
    expect(inFlight.verdict).toBe("sheet");
    // The slot leaves the screen for PAINT ORDER only: it keeps its owner's
    // transition, status and hold, so it moves with the screen it belongs to.
    expect(Math.abs(inFlight.left - atRest.left)).toBeGreaterThanOrEqual(40);

    await waitForNavIdle(page);
  });

  test("an inline sheet stays behind and loses the bar", async ({ page }) => {
    await setPlacement(page, "inline");
    await openSheet(page);

    expect((await atTheBar(page)).verdict).toBe("sheet");

    await page.locator("[data-playground-stage] button:has-text('Aria Wave')").click();
    await waitForDeparture(page);

    // The screen it was written in became a stacking context the moment it
    // took a transform, so the sheet can no longer outrank a bar that lives
    // outside that context — "content under the bar, sheet over the bar" is
    // "not expressible from in there, at any z-index".
    //
    // The VERDICT is the assertion, because it is the part attributable to
    // `<Layer>` alone: the same markup, one toggle apart, goes from covering
    // the bar to being covered by it.
    //
    // Travel is deliberately NOT asserted here. A first draft claimed the
    // trapped sheet does not move at all; measured, it moves 35px while the
    // hosted one moves far more, because a fixed child of a transformed screen
    // resolves against that screen's box and drags along with the parallax.
    // A number I had guessed rather than measured would have pinned the wrong
    // behaviour into the suite.
    const inFlight = await atTheBar(page);
    expect(inFlight.verdict).toBe("bar");

    await waitForNavIdle(page);
  });

  test("the sheet is a step, so it stacks no screen", async ({ page }) => {
    const screens = () => page.locator("[data-playground-stage] [data-flemo-screen]").count();

    const before = await screens();
    await setPlacement(page, "hosted");
    await openSheet(page);

    // "A step is a sub-state pushed onto history without stacking a new screen
    // (a param change)." The stack depth is the assertion; the sheet being
    // visible is not.
    expect(await screens()).toBe(before);

    await page.locator("[data-booking-sheet-close]").click();
    await waitForNavIdle(page);
    await expect(page.locator(SHEET)).toHaveCount(0);
    expect(await screens()).toBe(before);
  });
});
