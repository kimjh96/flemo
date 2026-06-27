import { expect, test } from "@playwright/test";

import { waitForTransitionSettled } from "./helpers/flemo";
import { probeVtEscape } from "./helpers/vtProbe";

// Regression: a non-composited (blur) transition runs through View Transitions,
// whose pseudo tree lives on the document top layer and would otherwise escape
// flemo's clipping container (the playground phone frame). buildViewTransitionCss
// clips the VT groups to the container's measured radius. This asserts the
// snapshot is fully contained — 0 marker escape on every edge — using the stable
// during-transition probe (the page scrolls mid-VT, so the frame is measured
// live, not at rest).
test.describe("View Transitions containment", () => {
  test.use({ viewport: { width: 1280, height: 1150 } });

  test("the blur snapshot stays inside flemo's frame on all edges", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    const escape = await probeVtEscape(page, "fetch-swap-push-blur-deferred-150-1500");

    expect(escape, JSON.stringify(escape)).toMatchObject({
      left: 0,
      right: 0,
      above: 0,
      below: 0
    });
  });
});
