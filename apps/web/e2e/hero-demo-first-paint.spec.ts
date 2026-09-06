import { expect, test } from "@playwright/test";

// THE HERO'S TWO CARDS MUST NEVER SHARE A POSE.
//
// They run one keyframe loop, offset by half a cycle, so one is always up front
// and the other receded. The offset used to be applied only by a client layout
// effect, on the reasoning that keeping it out of the markup is what keeps SSR
// phase-free. It does — and it also meant the served HTML gave both cards the
// same animation with the same absent delay, so both sat at the keyframe's 0%
// pose: identical transform, identical z-index, stacked exactly on top of each
// other with the music card, later in DOM order, covering the wallet outright.
//
// The browser painted that, then hydration threw the music card back in one
// frame. Measured on this page before the fix: 12 of 287 sampled frames, about
// 200ms of the wrong app in the hero. Reported from a screen recording as the
// demo flickering and resetting on every refresh.
//
// The sampler is installed BEFORE any page script, because the frames that
// matter are the ones painted before hydration — a probe that starts after it
// would find nothing wrong and say so.
test.describe("the hero demo's first paint", () => {
  test("never paints the two cards on top of each other", async ({ page }) => {
    await page.addInitScript(() => {
      const store = window as unknown as { __heroPoses: { same: boolean }[] };
      store.__heroPoses = [];
      const tick = () => {
        const bezels = [...document.querySelectorAll<HTMLElement>('[style*="flemo-card-roll"]')];
        if (bezels.length === 2) {
          const [a, b] = bezels.map((node) => getComputedStyle(node).transform);
          store.__heroPoses.push({ same: a === b });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.goto("/en");
    await page.waitForTimeout(1200);

    const poses = await page.evaluate(
      () => (window as unknown as { __heroPoses: { same: boolean }[] }).__heroPoses
    );
    // The sampler has to have seen the cards at all, or the assertion below is
    // true for the wrong reason.
    expect(poses.length).toBeGreaterThan(20);
    expect(poses.filter((pose) => pose.same)).toHaveLength(0);
  });

  test("serves the separated pose in the HTML itself", async ({ request }) => {
    const html = await (await request.get("/en")).text();
    const delays = [...html.matchAll(/animation-delay:\s*(-?[\d.]+s)/g)].map((match) => match[1]);
    // One card at the head of the loop, the other half a cycle behind it.
    expect(delays).toContain("-0s");
    expect(delays).toContain("-3.5s");
  });
});
