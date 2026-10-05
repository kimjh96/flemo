import { expect, test } from "@playwright/test";

import { navButton } from "./helpers/flemo";

// A ROUTER'S TRANSITION DOES NOT RESTART ANOTHER ROUTER'S.
//
// The docs page carries a live demo, a Router of its own that plays itself.
// When the header's Home tap started the shell's transition while the demo was
// partway through a push, the shell flipped the page-wide head gate the demo's
// compiled animation was matched under. Its animation-name changed, the
// browser restarted it from the first frame, and the demo's arriving screen
// jumped back and slid in again over the screen under it, which read as the
// page flashing back.

test("a demo's running push keeps its clock when the shell navigates away", async ({ page }) => {
  await page.goto("/docs/introduction");

  // Partway through one of the demo's own pushes.
  await page.waitForFunction(
    () => {
      const screen = [...document.querySelectorAll("figure [data-flemo-screen]")].find(
        (candidate) =>
          candidate.getAttribute("data-flemo-active") === "true" &&
          candidate.getAttribute("data-flemo-status") === "PUSHING"
      );
      const animation = screen?.getAnimations().find((running) => running.playState === "running");
      const time = Number(animation?.currentTime ?? 0);
      return time > 120 && time < 300;
    },
    null,
    { timeout: 20_000, polling: "raf" }
  );

  await page.evaluate(() => {
    const screen = [...document.querySelectorAll("figure [data-flemo-screen]")].find(
      (candidate) =>
        candidate.getAttribute("data-flemo-active") === "true" &&
        candidate.getAttribute("data-flemo-status") === "PUSHING"
    )!;
    const samples: { name: string; time: number }[] = [];
    (window as unknown as { __demoClock: typeof samples }).__demoClock = samples;
    const started = performance.now();
    const sample = () => {
      if (screen.getAttribute("data-flemo-status") !== "PUSHING") return;
      const animation = screen
        .getAnimations()
        .find((running) => running.playState === "running") as CSSAnimation | undefined;
      if (animation) {
        samples.push({ name: animation.animationName, time: Number(animation.currentTime) });
      }
      if (performance.now() - started < 400) requestAnimationFrame(sample);
    };
    sample();
  });

  await navButton(page, "Home").click();
  await page.waitForTimeout(500);

  const samples = await page.evaluate(
    () => (window as unknown as { __demoClock: { name: string; time: number }[] }).__demoClock
  );
  expect(samples.length).toBeGreaterThan(1);
  // One animation throughout, and its clock only moves forward.
  expect(new Set(samples.map((sample) => sample.name)).size).toBe(1);
  for (let i = 1; i < samples.length; i += 1) {
    expect(samples[i].time).toBeGreaterThanOrEqual(samples[i - 1].time);
  }
});
