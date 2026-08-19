import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

test.describe("touch gesture safety", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "touch arbitration is exercised in the Pixel 7 project"
    );
  });

  test("vertical scroll jitter never commits a page-wide horizontal swipe-back", async ({
    page
  }) => {
    await page.goto("/playground");
    await page.getByRole("button", { name: "Cupertino", exact: true }).first().click();
    await page.getByRole("button", { name: "Next" }).click();
    await waitForNavIdle(page);
    await expect(page).toHaveURL(/\/playground\/2$/);

    const scopes = page.locator(
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-active="true"]'
    );
    const scope = scopes.last();
    await scope.evaluate(async (element) => {
      const pointer = (type: string, x: number, y: number) =>
        element.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 7,
            pointerType: "touch",
            isPrimary: true,
            clientX: x,
            clientY: y,
            bubbles: true
          })
        );

      pointer("pointerdown", 180, 620);
      // Android flings commonly carry a tiny positive X component. The old
      // recognizer claimed the first 2px, then treated the browser's ensuing
      // pointercancel as a normal high-velocity release and popped.
      pointer("pointermove", 182, 570);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      pointer("pointermove", 184, 470);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      pointer("pointercancel", 184, 470);
    });

    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/playground\/2$/);
    await expect(scope).toHaveAttribute("data-flemo-status", "COMPLETED");
  });

  test("a touch started during push scrolls the destination after landing without a retouch", async ({
    page,
    context
  }) => {
    await page.goto("/docs/navigation");
    await waitForNavIdle(page);

    // The desktop sidebar remains mounted but visually hidden on mobile. A
    // synthetic setup click avoids opening the nav sheet; the touch stream
    // under test below is delivered through Chromium's real input domain.
    await page
      .getByRole("button", { name: "Introduction", exact: true, includeHidden: true })
      .first()
      .dispatchEvent("click");

    const incomingScope = page
      .locator('[data-flemo-screen][data-flemo-status="PUSHING"][data-flemo-active="true"]')
      .filter({ has: page.locator('[data-testid="docs-scroll"]') });
    await expect(incomingScope).toHaveCount(1);
    await expect(incomingScope).not.toHaveCSS("pointer-events", "none");

    const scroller = incomingScope.getByTestId("docs-scroll");
    const scrollerHandle = await scroller.elementHandle();
    expect(scrollerHandle).not.toBeNull();
    const activationProbe = await scroller
      .getByRole("button")
      .first()
      .evaluate((button) => {
        const htmlButton = button as HTMLButtonElement;
        let pointerDownCount = 0;
        let clickCount = 0;
        htmlButton.addEventListener("pointerdown", () => pointerDownCount++);
        htmlButton.addEventListener("click", () => clickCount++);
        htmlButton.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 99,
            pointerType: "mouse",
            isPrimary: true
          })
        );
        htmlButton.click();
        return { pointerDownCount, clickCount };
      });
    // The reduced activation gate is deliberate: click (including a native
    // target listener) is stopped, while low-level input remains observable so
    // the browser can establish and preserve a native scroll stream.
    expect(activationProbe).toEqual({ pointerDownCount: 1, clickCount: 0 });
    expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true
    );

    // The destination enters from the right. Start as soon as a real strip of
    // it is visible; using the transformed box centre would still be outside
    // the viewport and would not target any element at all.
    const start = await incomingScope.evaluate(async (scope) => {
      const scrollElement = scope.querySelector<HTMLElement>('[data-testid="docs-scroll"]')!;
      return new Promise<{ x: number; y: number }>((resolve, reject) => {
        const sample = () => {
          const rect = scrollElement.getBoundingClientRect();
          if (scope.getAttribute("data-flemo-status") !== "PUSHING") {
            reject(new Error("destination landed before the touch could start"));
            return;
          }
          if (rect.left < window.innerWidth - 32) {
            resolve({
              x: Math.max(16, rect.left + 16),
              y: Math.min(rect.bottom - 80, 700)
            });
            return;
          }
          requestAnimationFrame(sample);
        };
        sample();
      });
    });
    expect(
      await scroller.evaluate(
        (scrollElement, point) =>
          scrollElement.contains(document.elementFromPoint(point.x, point.y)),
        start
      )
    ).toBe(true);

    const cdp = await context.newCDPSession(page);
    const point = (y: number) => [{ x: start.x, y, radiusX: 1, radiusY: 1, force: 1, id: 1 }];

    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: point(start.y)
    });
    try {
      // Keep the same finger down across PUSHING -> COMPLETED. Pointer-event
      // targeting is fixed at touchStart, which is exactly the prior failure.
      await waitForNavIdle(page);
      for (const y of [start.y - 50, start.y - 110, start.y - 180]) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: point(y)
        });
        await page.waitForTimeout(16);
      }
    } finally {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    }

    await expect
      .poll(() => scrollerHandle!.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
  });
});
