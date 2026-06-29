import { expect, test } from "@playwright/test";

// flemo keeps the screen BENEATH a push MOUNTED (display:none) instead of
// unmounting it, so the browser preserves its scrollTop. Scroll a screen, push
// another over it, pop back, and the original must restore its exact scroll
// position. The short viewport guarantees the docs content overflows so there is
// something to scroll. (Peer nav, e.g. Docs -> Home -> Docs, pushes a fresh
// screen instead, so it intentionally does NOT restore scroll: this covers the
// push/pop case flemo guarantees.)
const SETTLE = 700;

// Only the active screen is visible; screens frozen beneath a push are
// display:none, so `:visible` always resolves to the one on top.
const VISIBLE_DOC_SCROLL = '[data-testid="docs-scroll"]:visible';

test.describe("scroll retention", () => {
  test.use({ viewport: { width: 1024, height: 640 } });

  test("a screen restores its scroll position after a push is popped", async ({ page }) => {
    await page.goto("/docs/navigation");
    await page.waitForTimeout(SETTLE);

    const scroller = page.locator(VISIBLE_DOC_SCROLL);
    await expect(scroller).toBeVisible();

    // Guard against a vacuous assertion: the content must actually overflow.
    const overflows = await scroller.evaluate((el) => el.scrollHeight > el.clientHeight + 50);
    expect(overflows).toBe(true);

    await scroller.evaluate((el) => {
      el.scrollTop = 200;
    });
    const before = await scroller.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(0);

    // Push another doc via the sidebar (the current page freezes but stays
    // mounted), then pop back with the browser.
    await page.getByRole("button", { name: "Introduction", exact: true }).click();
    await page.waitForTimeout(SETTLE);
    await page.goBack();
    await page.waitForTimeout(SETTLE);

    const after = await page.locator(VISIBLE_DOC_SCROLL).evaluate((el) => el.scrollTop);
    expect(after).toBe(before);
  });
});
