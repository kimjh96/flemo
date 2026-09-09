import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// A DRAG AND THE POP IT WALKS ARE THE SAME MOTION, OR THEY ARE A BUG.
//
// A swipe-back walks the transition's own pop at the finger. Everything riding
// those screens therefore has two ways to be driven, and until this they did
// not agree:
//
//   the flight  runs every participant on one clock, each on its own curve
//   the drag    seeked each participant through the inverse of ITS OWN curve,
//               which cancels that curve and leaves it at the gesture's own
//               fraction of its travel
//
// So a `<Part>` was at one place under a finger and another in the air at the
// same screen position, and the same hand-over read as two different motions
// depending on how it started. Reported from the playground.
//
// This measures the two against each other on the one axis they share: WHERE
// THE SCREEN IS. Nothing here asserts a curve or a duration; it asserts that
// the chrome is in the same place when the screen is.
const STAGE = "a, button, [role=tab]";
const CHROME = '[data-flemo-part-name="detail-chrome"]';

const enterCase = async (page: import("@playwright/test").Page, name: string) => {
  await page.goto("/en/playground");
  await waitForNavIdle(page);
  await page.evaluate(
    ({ selector, label }) => {
      const control = [...document.querySelectorAll(selector)].find(
        (element) => (element.textContent ?? "").trim() === label
      );
      (control as HTMLElement | undefined)?.click();
    },
    { selector: STAGE, label: name }
  );
  await page.waitForTimeout(500);
  await page.evaluate((selector) => {
    const card = [...document.querySelectorAll(selector)].find((element) =>
      /Aria Wave/.test(element.textContent ?? "")
    );
    (card as HTMLElement | undefined)?.click();
  }, STAGE);
  await waitForNavIdle(page);

  return page.evaluate(() => {
    const active = [...document.querySelectorAll("[data-flemo-screen][data-flemo-router]")].find(
      (element) =>
        element.getAttribute("data-flemo-active") === "true" &&
        element.getAttribute("data-flemo-screen") !== "root"
    );
    if (!active) return null;
    const rect = active.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
};

/** Where the dragged screen is across its own width, and what its chrome reads. */
const readPair = (page: import("@playwright/test").Page, chrome: string) =>
  page.evaluate((selector) => {
    const screen = [...document.querySelectorAll("[data-flemo-screen][data-flemo-router]")].find(
      (element) =>
        element.getAttribute("data-flemo-active") === "true" &&
        element.getAttribute("data-flemo-screen") !== "root"
    ) as HTMLElement | undefined;
    const part = screen?.querySelector<HTMLElement>(selector);
    if (!screen || !part) return null;
    const style = getComputedStyle(screen);
    const shifted =
      new DOMMatrixReadOnly(style.transform).m41 + (Number.parseFloat(style.translate) || 0);
    return {
      across: shifted / (screen.getBoundingClientRect().width || 1),
      opacity: Number.parseFloat(getComputedStyle(part).opacity)
    };
  }, chrome);

test.describe("a part under a finger and the same part in the air", () => {
  test("reads the same at the same screen position", async ({ page }) => {
    const box = await enterCase(page, "cupertino");
    test.skip(box === null, "no pushed screen on this bench");

    // THE FLIGHT FIRST, sampled every frame of a real pop. `detail-chrome` runs
    // 0.16s against cupertino's 0.7s, so it is done while the screen is still
    // going: the curve of this trace is the thing the drag has to reproduce.
    await page.evaluate((selector) => {
      const trace: { across: number; opacity: number }[] = [];
      (window as unknown as { __flight: typeof trace }).__flight = trace;
      const read = () => {
        const screen = [
          ...document.querySelectorAll("[data-flemo-screen][data-flemo-router]")
        ].find(
          (element) =>
            element.getAttribute("data-flemo-active") === "true" &&
            element.getAttribute("data-flemo-screen") !== "root"
        ) as HTMLElement | undefined;
        const part = screen?.querySelector<HTMLElement>(selector);
        if (screen && part) {
          const style = getComputedStyle(screen);
          const shifted =
            new DOMMatrixReadOnly(style.transform).m41 + (Number.parseFloat(style.translate) || 0);
          trace.push({
            across: shifted / (screen.getBoundingClientRect().width || 1),
            opacity: Number.parseFloat(getComputedStyle(part).opacity)
          });
        }
        if (trace.length < 80) requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    }, CHROME);
    await page.getByRole("button", { name: "Back" }).click();
    await page.waitForTimeout(1100);

    const flight = (
      await page.evaluate(
        () => (window as unknown as { __flight: { across: number; opacity: number }[] }).__flight
      )
    ).filter((sample) => Number.isFinite(sample.across) && sample.across >= 0);
    expect(flight.length).toBeGreaterThan(10);
    // It went somewhere and the chrome went with it, or there is nothing here
    // to compare a drag against.
    expect(Math.max(...flight.map((sample) => sample.across))).toBeGreaterThan(0.5);
    expect(Math.min(...flight.map((sample) => sample.opacity))).toBeLessThan(0.2);

    /**
     * What the flight had the chrome at when the screen was this far across.
     *
     * INTERPOLATED, not nearest. The flight is sampled per frame, and a frame
     * is a long way in `across` exactly where cupertino's curve moves fastest:
     * the screen covers half its travel in the first sixth of the clock. Taking
     * the nearest sample there compares two different screen positions and
     * charges the difference to the drag. On a loaded runner that read as a
     * 0.09 error against a 0.03 one locally, which is the resolution of the
     * trace rather than anything the drag did.
     */
    const flightAt = (across: number) => {
      const sorted = [...flight].sort((a, b) => a.across - b.across);
      const after = sorted.findIndex((sample) => sample.across >= across);
      if (after <= 0) return sorted[0]!.opacity;
      const low = sorted[after - 1]!;
      const high = sorted[after]!;
      const span = high.across - low.across;
      if (span <= 0) return low.opacity;
      const t = (across - low.across) / span;
      return low.opacity + (high.opacity - low.opacity) * t;
    };

    // THE DRAG, stopped at three points along the same axis.
    const dragged = await enterCase(page, "cupertino");
    expect(dragged).not.toBeNull();
    const y = dragged!.y + dragged!.height / 2;
    await page.mouse.move(dragged!.x + 3, y);
    await page.mouse.down();

    const compared: { across: number; drag: number; air: number }[] = [];
    for (const fraction of [0.3, 0.55, 0.8]) {
      await page.mouse.move(dragged!.x + dragged!.width * fraction, y, { steps: 8 });
      await page.waitForTimeout(120);
      const pair = await readPair(page, CHROME);
      expect(pair).not.toBeNull();
      compared.push({ across: pair!.across, drag: pair!.opacity, air: flightAt(pair!.across) });
    }
    await page.mouse.up();

    // The finger and the flight put the chrome in the same place. Measured at
    // the three points above, screen position against chrome opacity:
    //
    //   across  flight   drag now   drag before
    //   0.25    0.763    0.763      0.748
    //   0.50    0.431    0.432      0.498
    //   0.75    0.007    0.001      0.248
    //
    // The last row is the whole report in one number: the flight has this
    // header gone by three quarters of the way across, because it runs 0.16s of
    // cupertino's 0.7s, and the drag used to still be showing a quarter of it.
    //
    // The threshold is eight times the 0.006 the matched build reaches, and the
    // old arithmetic is already outside it at the MIDDLE sample (0.067) before
    // reaching the 0.24 of the last one. That order matters: the loop reports
    // the first sample that fails, so a regression is caught at 0.50 rather
    // than at the obvious end.
    for (const sample of compared) {
      expect(Math.abs(sample.drag - sample.air)).toBeLessThan(0.05);
    }
    // And the comparison is not trivially satisfied by a part that never moves.
    expect(Math.max(...compared.map((sample) => sample.drag))).toBeGreaterThan(0.2);
    expect(Math.min(...compared.map((sample) => sample.drag))).toBeLessThan(0.8);
  });
});

// AND THE DIM, which was the worse offender of the two and hid behind its own
// hooks.
//
// `overlay` used to drive its own drag with `onSwipe: 1 - progress / 100`,
// which opts a decorator out of the declarative rider entirely. So the wash was
// linear in the SCREEN'S POSITION under a finger while the flight ran it on the
// clock it inherits: at a screen three quarters across the flight had it at
// 0.62 and the drag at 0.245. Removing the hooks puts it on the same phase as
// everything else riding the gesture.
test.describe("the dim under a finger and the same dim in the air", () => {
  /** The wash over the screen being returned to, and where its screen is. */
  const readDim = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const screen = [...document.querySelectorAll("[data-flemo-screen][data-flemo-router]")].find(
        (element) =>
          element.getAttribute("data-flemo-active") === "true" &&
          element.getAttribute("data-flemo-screen") !== "root"
      ) as HTMLElement | undefined;
      const dim = [...document.querySelectorAll<HTMLElement>("[data-flemo-decorator]")].find(
        (element) => element.getAttribute("data-flemo-decorator-owner") === "root"
      );
      if (!screen || !dim) return null;
      const style = getComputedStyle(screen);
      const shifted =
        new DOMMatrixReadOnly(style.transform).m41 + (Number.parseFloat(style.translate) || 0);
      return {
        across: shifted / (screen.getBoundingClientRect().width || 1),
        opacity: Number.parseFloat(getComputedStyle(dim).opacity)
      };
    });

  test("reads the same at the same screen position", async ({ page }) => {
    const box = await enterCase(page, "cupertino");
    test.skip(box === null, "no pushed screen on this bench");

    await page.evaluate(() => {
      const trace: { across: number; opacity: number }[] = [];
      (window as unknown as { __dim: typeof trace }).__dim = trace;
      const read = () => {
        const screen = [
          ...document.querySelectorAll("[data-flemo-screen][data-flemo-router]")
        ].find(
          (element) =>
            element.getAttribute("data-flemo-active") === "true" &&
            element.getAttribute("data-flemo-screen") !== "root"
        ) as HTMLElement | undefined;
        const dim = [...document.querySelectorAll<HTMLElement>("[data-flemo-decorator]")].find(
          (element) => element.getAttribute("data-flemo-decorator-owner") === "root"
        );
        if (screen && dim) {
          const style = getComputedStyle(screen);
          const shifted =
            new DOMMatrixReadOnly(style.transform).m41 + (Number.parseFloat(style.translate) || 0);
          trace.push({
            across: shifted / (screen.getBoundingClientRect().width || 1),
            opacity: Number.parseFloat(getComputedStyle(dim).opacity)
          });
        }
        if (trace.length < 90) requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    await page.getByRole("button", { name: "Back" }).click();
    await page.waitForTimeout(1200);

    const flight = (
      await page.evaluate(
        () => (window as unknown as { __dim: { across: number; opacity: number }[] }).__dim
      )
    ).filter((sample) => Number.isFinite(sample.across) && sample.across >= 0);
    expect(flight.length).toBeGreaterThan(10);
    // The wash cleared as the screen went, or there is nothing to compare.
    expect(Math.max(...flight.map((sample) => sample.opacity))).toBeGreaterThan(0.8);
    expect(Math.min(...flight.map((sample) => sample.opacity))).toBeLessThan(0.2);

    const flightAt = (across: number) => {
      const sorted = [...flight].sort((a, b) => a.across - b.across);
      const after = sorted.findIndex((sample) => sample.across >= across);
      if (after <= 0) return sorted[0]!.opacity;
      const low = sorted[after - 1]!;
      const high = sorted[after]!;
      const span = high.across - low.across;
      if (span <= 0) return low.opacity;
      return low.opacity + (high.opacity - low.opacity) * ((across - low.across) / span);
    };

    const dragged = await enterCase(page, "cupertino");
    expect(dragged).not.toBeNull();
    const y = dragged!.y + dragged!.height / 2;
    await page.mouse.move(dragged!.x + 3, y);
    await page.mouse.down();

    const compared: { drag: number; air: number }[] = [];
    for (const fraction of [0.3, 0.55, 0.8]) {
      await page.mouse.move(dragged!.x + dragged!.width * fraction, y, { steps: 8 });
      await page.waitForTimeout(120);
      const pair = await readDim(page);
      expect(pair).not.toBeNull();
      compared.push({ drag: pair!.opacity, air: flightAt(pair!.across) });
    }
    await page.mouse.up();

    // Measured: 0.9121 against 0.9121, 0.7908 against 0.7906, 0.6197 against
    // 0.6195. With the hooks back the same three read 0.745, 0.495 and 0.245,
    // so the first sample alone is already 0.167 outside this.
    for (const sample of compared) {
      expect(Math.abs(sample.drag - sample.air)).toBeLessThan(0.05);
    }
    // And not trivially satisfied by a wash that never moves.
    expect(compared[0]!.drag - compared[2]!.drag).toBeGreaterThan(0.15);
  });
});
