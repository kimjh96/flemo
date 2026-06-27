import { expect, test } from "@playwright/test";

import { waitForTransitionSettled } from "./helpers/flemo";

// A non-composited transition (blur) routes through the View Transitions API
// where it exists. Where it doesn't, it must fall back to the CSS-keyframe path
// and still navigate correctly. We force the API off and assert the fallback,
// so the graceful-degradation guarantee is covered in normal CI (chromium).
test.describe("View Transitions fallback", () => {
  test("non-composited transition uses the CSS path when startViewTransition is unavailable", async ({
    page
  }) => {
    // Remove the API before any app code can read it.
    await page.addInitScript(() => {
      // @ts-expect-error force-unset the optional API
      delete Document.prototype.startViewTransition;
      // @ts-expect-error force-unset any own property
      delete document.startViewTransition;
    });

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/playground");
    await waitForTransitionSettled(page);
    expect(await page.evaluate(() => typeof document.startViewTransition)).not.toBe("function");

    // Push a non-composited (blur) transition and sample the active scope's
    // status across the navigation with an in-browser rAF loop, so the transient
    // PUSHING isn't missed to a polling race. The VT path mounts at COMPLETED and
    // never enters PUSHING; the CSS fallback path does.
    await page.getByTestId("fetch-swap-push-blur-deferred-150-1500").click();
    const statuses = await page.evaluate(async () => {
      const seen = new Set<string>();
      const start = performance.now();
      while (performance.now() - start < 800) {
        const status = document
          .querySelector('[data-flemo-screen][data-flemo-active="true"]')
          ?.getAttribute("data-flemo-status");
        if (status) seen.add(status);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return [...seen];
    });
    await waitForTransitionSettled(page);

    expect(statuses).toContain("PUSHING"); // took the CSS-keyframe fallback, not VT
    await expect(page.locator("[data-fetch-swap]")).toBeVisible(); // navigation completed
    expect(errors).toEqual([]);
  });
});
