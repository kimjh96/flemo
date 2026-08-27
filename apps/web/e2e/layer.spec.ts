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

// Wait until the OUTER screen has actually moved. The overlay lives in that
// screen's container, so an outer push is the case where the thing moving
// under the sheet is not the sheet's owner at all.
async function waitForRegionDeparture(page: Page, minimumPx = 40) {
  await page.waitForFunction(
    (minimum) => {
      const outer = document
        .querySelector("[data-flemo-layer-host]")
        ?.parentElement?.querySelector("[data-flemo-screen]");
      if (!outer) return false;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(outer).transform);
      return Math.abs(matrix.m41) >= minimum;
    },
    minimumPx,
    { polling: "raf" }
  );
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

  test("an outer push carries the sheet with the region, not out from under it", async ({
    page
  }) => {
    await openSheet(page, true);

    const before = await page.evaluate(() => {
      const sheet = document.querySelector("[data-layer-sheet]");
      return sheet ? Math.round(sheet.getBoundingClientRect().left) : null;
    });
    expect(before).not.toBeNull();

    await page.locator(OUT).click();
    await waitForRegionDeparture(page);

    // The case the unit tests could not have caught and the previous suite did
    // not ask: here the moving screen is an ANCESTOR of the sheet's owner, so
    // the owner's own status is idle for the whole flight. An overlay that
    // only ever rides its owner sits perfectly still while the entire region
    // slides out from under it — measured in a consumer app before the host
    // learned to ride its own screen.
    const [after, regionTx] = await page.evaluate(() => {
      const sheet = document.querySelector("[data-layer-sheet]");
      const outer = document
        .querySelector("[data-flemo-layer-host]")
        ?.parentElement?.querySelector("[data-flemo-screen]");
      return [
        sheet ? Math.round(sheet.getBoundingClientRect().left) : null,
        outer ? Math.round(new DOMMatrixReadOnly(getComputedStyle(outer).transform).m41) : null
      ];
    });

    expect(after).not.toBeNull();
    expect(regionTx).not.toBeNull();
    // The sheet moved by the same amount the region did, within a pixel of
    // sampling skew.
    expect(Math.abs(after! - before! - regionTx!)).toBeLessThanOrEqual(4);

    await waitForNavIdle(page);
  });

  test("a swipe-back drags the sheet along with the screen it belongs to", async ({ page }) => {
    // The gesture is a THIRD driver, and it was the one nobody drove. A drag
    // does not run the compiled rules: it writes inline styles frame by frame
    // and enumerates its riders by walking the moving screen's container — a
    // walk that cannot reach a slot, because a slot lives in an ancestor's
    // host. Every earlier case here went through a programmatic push, so all
    // of them passed while a real swipe left the sheet standing still.
    await openSheet(page, true);
    await page.locator(STEP).click();
    await waitForNavIdle(page);

    const viewport = page.viewportSize()!;
    await page.mouse.move(2, viewport.height / 2);
    await page.mouse.down();
    for (const x of [20, 60, 110, 160, 210]) {
      await page.mouse.move(x, viewport.height / 2, { steps: 3 });
      await page.waitForTimeout(45);
    }

    const held = await page.evaluate(() => {
      const owner = document.querySelector('[data-layer-step="A"]')?.closest("[data-flemo-screen]");
      const slot = document.querySelector("[data-flemo-layer-slot]");
      const tx = (element: Element | null | undefined) =>
        element ? Math.round(new DOMMatrixReadOnly(getComputedStyle(element).transform).m41) : null;
      return { ownerTx: tx(owner), slotTx: tx(slot) };
    });

    await page.mouse.up();

    expect(held.ownerTx).not.toBeNull();
    // Held far enough in that a sheet standing still is unmistakable.
    expect(Math.abs(held.ownerTx!)).toBeGreaterThan(30);
    expect(held.slotTx).toBe(held.ownerTx);

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

  test("an overlay is promoted for the flight like a riding bar is", async ({ page }) => {
    // The engine pins each participant's compositor layer inline for the whole
    // flight, because the compiled rule's own `will-change` UN-matches at the
    // COMPLETED flip and would demote and repaint on exactly the frames the
    // eye watches settle. Riding bars have been in that set for a long time.
    // An overlay rides the same keyframes, so it belongs in it too — and this
    // is the half no coordinate check can see: the sheet lands in the right
    // place either way, and only the frames differ.
    await openSheet(page, true);
    await page.locator(STEP).click();
    await waitForDeparture(page);

    const promoted = await page.evaluate(() => {
      // Riders IN this flight only. A host whose own screen is idle carries a
      // status too, and it is correctly left alone — asserting on every rider
      // would fail on the one element that is behaving.
      const flying = [
        ...document.querySelectorAll<HTMLElement>(
          "[data-flemo-layer-host], [data-flemo-layer-slot]"
        )
      ].filter((element) => {
        const status = element.getAttribute("data-flemo-status") ?? "";
        return status === "PUSHING" || status === "POPPING" || status === "REPLACING";
      });
      return flying.map((element) => element.style.willChange);
    });

    expect(promoted.length).toBeGreaterThan(0);
    for (const willChange of promoted) expect(willChange).not.toBe("");

    await waitForNavIdle(page);
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
