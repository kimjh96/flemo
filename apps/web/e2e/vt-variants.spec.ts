import { expect, test } from "@playwright/test";

import { waitForTransitionSettled } from "./helpers/flemo";

// Guards the View Transitions variant DIRECTION, which the settle-based tests
// can't see: a swapped variant still navigates correctly, only the animation is
// wrong. We capture the injected ::view-transition rules during the navigation
// (rAF-sampled so the transient style isn't missed) and assert each pseudo-
// element references the right compiled @keyframes.
//
// The active screen differs by navigation: it is the ENTERING screen for push
// (so new = PUSHING-true), but the LEAVING screen for pop (so the revealed
// screen, the new snapshot, must play POPPING-false and the leaving one
// POPPING-true).
const capture = async (page: import("@playwright/test").Page) =>
  page.evaluate(async () => {
    const start = performance.now();
    let css = "";
    while (performance.now() - start < 900) {
      const text = document.querySelector("#flemo-view-transition")?.textContent;
      if (text) css = text;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return css;
  });

test.describe("View Transitions variant direction", () => {
  test("push and pop reference the correct keyframes", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    // PUSH a non-composited (blur) transition; capture the injected rules.
    const pushClick = page.getByTestId("fetch-swap-push-blur-deferred-150-1500").click();
    const pushCss = await capture(page);
    await pushClick;
    await waitForTransitionSettled(page);
    // entering screen is active → new = PUSHING-true
    expect(pushCss).toMatch(
      /::view-transition-new\(flemo-vt-new\)[^}]*flemo-screen-blur-PUSHING-true/
    );

    // POP back; capture again.
    const popClick = page.getByLabel("Back").first().click();
    const popCss = await capture(page);
    await popClick;
    await waitForTransitionSettled(page);
    // leaving screen is active on pop → revealed (new) plays POPPING-false,
    // leaving (old) plays POPPING-true.
    expect(popCss).toMatch(
      /::view-transition-new\(flemo-vt-new\)[^}]*flemo-screen-blur-POPPING-false/
    );
    expect(popCss).toMatch(
      /::view-transition-old\(flemo-vt-old\)[^}]*flemo-screen-blur-POPPING-true/
    );
  });
});
