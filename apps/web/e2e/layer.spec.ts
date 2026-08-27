import { expect, test, type Page } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// The layering rule, driven rather than described.
//
// jsdom does no layout and no paint, so the unit tests beside <Layer> can only
// pin where the DOM lands and whose the overlay still is. What it actually
// COVERS, and whether it travels with the screen that owns it, are browser
// questions. This is where the repository asks them.
//
// Every case reads pixels or geometry. The one thing that is never asserted is
// that a rule "is applied" — a paint order that agrees with the stylesheet and
// disagrees with the screen is exactly the failure the previous suite shipped.

const OPEN = "[data-layer-open]";
const TOGGLE = "[data-layer-toggle]";
const STEP = "[data-layer-step-push]";
const OUT = "[data-layer-region-push]";
const SHEET = "[data-layer-sheet]";

async function openSheet(page: Page, hosted: boolean) {
  const toggle = page.locator(TOGGLE);
  if ((await toggle.getAttribute("aria-pressed")) !== String(hosted)) await toggle.click();
  if ((await page.locator(SHEET).count()) === 0) await page.locator(OPEN).click();
  await expect(page.locator(SHEET)).toBeVisible();
}

// Who paints at the middle of the bar — the sheet, the bar, or neither. Read
// at the bar's own centre, which is where its black stripe is, so a "sheet"
// verdict means the same thing the eye reports.
async function atTheBar(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector("[data-layer-bar]");
    const sheet = document.querySelector("[data-layer-sheet]");
    if (!bar || !sheet) return { verdict: "missing" as const, sheetBottom: 0, viewportBottom: 0 };

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
      viewportBottom: window.innerHeight
    };
  });
}

// Wait until the sheet's OWN screen has actually moved.
//
// Sampling on the PUSHING flip alone measures nothing: at t=0 the screen is
// still at its start pose, so a sheet that travels and a sheet that is pinned
// read identically and every assertion below passes on a broken build. Proven
// by breaking one. Poll the departing screen's transform instead and read only
// once there is a displacement worth comparing against.
async function waitForDeparture(page: Page, minimumPx = 40) {
  await page.waitForFunction(
    (minimum) => {
      const owner = document.querySelector('[data-layer-step="A"]')?.closest("[data-flemo-screen]");
      if (!owner) return false;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(owner).transform);
      return Math.abs(matrix.m41) >= minimum;
    },
    minimumPx,
    { polling: "raf" }
  );
}

// The two halves of the registration line: the screen's and the sheet's. They
// are one line when the sheet is travelling with its screen, and two when it
// is not.
async function registrationGap(page: Page) {
  return page.evaluate(() => {
    const onScreen = document.querySelector('[data-layer-registration="screen"]');
    const onSheet = document.querySelector('[data-layer-registration="sheet"]');
    if (!onScreen || !onSheet) return null;
    return Math.abs(onScreen.getBoundingClientRect().left - onSheet.getBoundingClientRect().left);
  });
}

test.describe("overlay layering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/playground/layer");
    await waitForNavIdle(page);
  });

  test("a hosted sheet reaches the floor and cuts through the bar", async ({ page }) => {
    await openSheet(page, true);

    const result = await atTheBar(page);
    expect(result.verdict).toBe("sheet");
    // Nothing between it and the viewport is a containing block, so it lands
    // on the real floor rather than on the screen box's.
    expect(result.viewportBottom - result.sheetBottom).toBeLessThanOrEqual(1);
  });

  test("the same sheet written in the screen never reaches the bar at all", async ({ page }) => {
    await openSheet(page, false);

    // At rest the sheet DOES reach the viewport floor — `position: fixed`
    // walks past an `overflow: hidden` ancestor that is not a containing block
    // — and still loses, because the ancestor's bar is a positioned sibling
    // above the whole region and a z-index written inside the region has
    // nothing to bid against it with.
    const atRest = await atTheBar(page);
    expect(atRest.verdict).toBe("bar");
    expect(atRest.viewportBottom - atRest.sheetBottom).toBeLessThanOrEqual(1);

    await page.locator(STEP).click();
    await waitForDeparture(page);

    // And the flight adds the third wall: the screen's transform becomes a
    // containing block, so `bottom: 0` stops meaning the viewport entirely.
    const inFlight = await atTheBar(page);
    expect(inFlight.viewportBottom - inFlight.sheetBottom).toBeGreaterThanOrEqual(60);

    // This case is what keeps the hosted ones from being vacuous. If it ever
    // passes for BOTH placements, the fixture has stopped measuring <Layer>.
    await waitForNavIdle(page);
  });

  test("a hosted sheet keeps cutting through the bar while a screen flies", async ({ page }) => {
    await openSheet(page, true);
    await page.locator(STEP).click();
    await waitForDeparture(page);

    expect((await atTheBar(page)).verdict).toBe("sheet");

    await waitForNavIdle(page);
  });

  test("a hosted sheet travels WITH its screen instead of hanging over it", async ({ page }) => {
    await openSheet(page, true);

    const atRest = await registrationGap(page);
    expect(atRest).not.toBeNull();
    expect(atRest!).toBeLessThanOrEqual(1);

    await page.locator(STEP).click();
    await waitForDeparture(page);

    // The one #344 got wrong. Its sheet stayed pinned to the viewport while
    // the screen slid out from under it, so the line broke — and the suite it
    // shipped asserted that as the specification.
    const inFlight = await registrationGap(page);
    expect(inFlight).not.toBeNull();
    expect(inFlight!).toBeLessThanOrEqual(4);

    await waitForNavIdle(page);
  });

  test("a push in the outer Router covers the sheet along with the region", async ({ page }) => {
    await openSheet(page, true);
    await page.locator(OUT).click();
    await waitForNavIdle(page);

    // Covering the sheet needs no rule of its own: the arriving screen's
    // container outranks the whole container the sheet lives in. The sheet is
    // still mounted and still open — it is the region that moved.
    const covered = await page.evaluate(() => {
      const sheet = document.querySelector("[data-layer-sheet]");
      const away = document.querySelector("[data-layer-away]");
      if (!sheet || !away) return null;

      const box = sheet.getBoundingClientRect();
      const stack = document.elementsFromPoint(
        Math.round(box.left + box.width / 2),
        Math.round(box.top + box.height / 2)
      );
      const sheetIndex = stack.findIndex((element) => sheet.contains(element));
      const awayIndex = stack.findIndex((element) => away.contains(element));
      return { sheetIndex, awayIndex };
    });

    expect(covered).not.toBeNull();
    expect(covered!.awayIndex).toBeGreaterThanOrEqual(0);
    expect(covered!.awayIndex).toBeLessThan(
      covered!.sheetIndex < 0 ? Number.POSITIVE_INFINITY : covered!.sheetIndex
    );
  });

  test("the bar is reachable when the host is empty", async ({ page }) => {
    // The host spans the region. If it took pointers, the fixture's own bar
    // would stop hit-testing the moment a screen mounted, with nothing on
    // screen to suggest why.
    const hit = await page.evaluate(() => {
      const bar = document.querySelector("[data-layer-bar]");
      if (!bar) return null;
      const box = bar.getBoundingClientRect();
      const top = document.elementFromPoint(
        Math.round(box.left + box.width / 2),
        Math.round(box.top + box.height / 2)
      );
      return { insideBar: bar.contains(top), isHost: top?.hasAttribute("data-flemo-layer-host") };
    });

    expect(hit).not.toBeNull();
    expect(hit!.isHost).toBe(false);
    expect(hit!.insideBar).toBe(true);
  });

  test("the sheet survives a step, because the case lives above the Router", async ({ page }) => {
    await openSheet(page, true);
    await page.locator(STEP).click();
    await waitForNavIdle(page);

    // Not a library behaviour — a fixture one, and it is load-bearing. With
    // the flags in the screen's own state a push reset them, which put the
    // only arrangement worth judging out of reach.
    await expect(page.locator(SHEET)).toBeVisible();
    await expect(page.locator("[data-layer-step='B']")).toBeVisible();
  });
});
