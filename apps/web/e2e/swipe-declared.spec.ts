import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// WHAT A DECLARED DRAG DOES ON GLASS, which is the one thing its unit tests
// cannot answer.
//
// Those run in jsdom against a stubbed `element.animate`, so what they check is
// that the right keyframes were assembled. Whether a browser then interpolates
// through a stop the way the declaration meant, and whether the scrub lands on
// that stop at the progress it claims, is a question only a real engine
// answers. The `tether` bench case exists to be asked it: its drag spends the
// screen's opacity by a third of the way across and keeps sliding for the rest,
// and it carries the floating header by hand while flemo keeps the screens.

const STAGE = "a, button, [role=tab]";

/** Open a bench case by the name on its control and push the detail screen. */
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
    const screens = [...document.querySelectorAll("[data-flemo-screen][data-flemo-router]")];
    const active = screens.find(
      (element) =>
        element.getAttribute("data-flemo-active") === "true" &&
        element.getAttribute("data-flemo-screen") !== "root"
    );
    if (!active) return null;
    const rect = active.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
};

/** The dragged screen's travel and opacity, and its header's own offset. */
const readDrag = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const screen = [...document.querySelectorAll<HTMLElement>("[data-flemo-screen]")].find(
      (element) =>
        element.getAttribute("data-flemo-active") === "true" &&
        element.getAttribute("data-flemo-screen") !== "root"
    );
    if (!screen) return null;
    const header = screen.querySelector<HTMLElement>("header");
    const style = getComputedStyle(screen);
    return {
      x: new DOMMatrixReadOnly(style.transform).m41,
      opacity: Number(style.opacity),
      // What the SCREEN carries inline. A scrubbed screen is moved by an
      // animation, so this stays empty however far the drag has gone.
      screenInline: screen.style.transform,
      headerX: header ? new DOMMatrixReadOnly(getComputedStyle(header).transform).m41 : null,
      headerInline: header ? header.style.transform : null
    };
  });

test.describe("a drag declared with stops", () => {
  test("spends one property early while another keeps travelling", async ({ page }) => {
    const stage = await enterCase(page, "tether");
    test.skip(stage === null, "no pushed screen on this bench");
    const box = stage!;

    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 5, y);
    await page.mouse.down();

    const at = async (fraction: number) => {
      await page.mouse.move(box.x + box.width * fraction, y, { steps: 8 });
      await page.waitForTimeout(70);
      const read = await readDrag(page);
      expect(read).not.toBeNull();
      return read!;
    };

    // WHERE the stop lands under the finger is not the invariant, and pinning
    // it would be pinning the easing and the span arithmetic with it. What a
    // stop MEANS is that one property arrives and holds while another carries
    // on, and that is what is read here.
    const early = await at(0.15);
    const settled = await at(0.6);
    const later = await at(0.8);
    const latest = await at(0.95);

    // The fade is spent: far down from where it started, then unmoved across
    // the rest of the drag.
    expect(early.opacity).toBeGreaterThan(0.7);
    expect(settled.opacity).toBeLessThan(0.45);
    expect(Math.abs(latest.opacity - later.opacity)).toBeLessThan(0.02);

    // And the slide has not stopped with it.
    expect(later.x).toBeGreaterThan(settled.x + box.width * 0.1);
    expect(latest.x).toBeGreaterThan(later.x + box.width * 0.1);

    await page.mouse.up();
    await page.waitForTimeout(900);
  });

  test("keeps the screen on an animation while a hook carries the header", async ({ page }) => {
    const stage = await enterCase(page, "tether");
    test.skip(stage === null, "no pushed screen on this bench");
    const box = stage!;

    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 5, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, y, { steps: 12 });
    await page.waitForTimeout(60);

    const mid = await readDrag(page);
    expect(mid).not.toBeNull();
    // The screen moved, and NOT by anyone writing to it: declaring where the
    // drag goes keeps it on the scrub even though this transition also writes
    // a hook, so its inline transform is untouched.
    expect(mid!.x).toBeGreaterThan(box.width * 0.2);
    expect(mid!.screenInline).toBe("");
    // The header is the hook's, so it IS written per frame, and it trails the
    // screen rather than riding it.
    expect(mid!.headerInline).not.toBe("");
    expect(mid!.headerX).toBeLessThan(0);

    await page.mouse.up();
    await page.waitForTimeout(900);
  });
});
