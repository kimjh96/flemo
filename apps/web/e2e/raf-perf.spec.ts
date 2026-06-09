import { test, type Page, type TestInfo } from "@playwright/test";

import { albumTile, waitForTransitionSettled } from "./helpers/flemo";

// Shared sampler. Arms rAF before the push, drains after the transition
// settles, logs a one-line summary keyed by `label` so multiple variants in
// the same file are distinguishable in the report.
async function samplePushRafCadence(page: Page, testInfo: TestInfo, label: string) {
  await page.evaluate(() => {
    const samples: number[] = [];
    let running = true;
    let last = performance.now();
    const tick = (now: number) => {
      samples.push(now - last);
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame((now) => {
      last = now;
      requestAnimationFrame(tick);
    });
    (window as unknown as { __flemoRafStop: () => number[] }).__flemoRafStop = () => {
      running = false;
      return samples;
    };
  });

  await albumTile(page, 0).click();
  await waitForTransitionSettled(page);
  await page.waitForTimeout(50);

  const samples = await page.evaluate(() =>
    (window as unknown as { __flemoRafStop: () => number[] }).__flemoRafStop()
  );

  const deltas = samples.slice(1);
  if (deltas.length === 0) {
    testInfo.annotations.push({ type: "raf", description: `${label}: no samples recorded` });
    return;
  }

  const sorted = [...deltas].sort((a, b) => a - b);
  const sum = deltas.reduce((acc, d) => acc + d, 0);
  const avg = sum / deltas.length;
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  const longFrames = deltas.filter((d) => d > 32).length;

  const summary = `${label}: samples=${deltas.length} min=${min.toFixed(1)}ms avg=${avg.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms long(>32ms)=${longFrames}`;
  testInfo.annotations.push({ type: "raf", description: summary });
  // eslint-disable-next-line no-console
  console.log(`[raf-perf] ${summary}`);
}

// Diagnostic-only smoke for the compositor-promotion path (commits `3c79a56`
// + `9e0384c`). During a single push transition we sample
// `requestAnimationFrame` intervals on the main thread. If the screen + bar
// pair is truly running on the compositor, the JS event loop should stay
// roughly idle and rAF should tick on a stable ~16.7ms cadence. If the loop
// is doing per-frame style reads/writes, we'd see fat tail latencies.
//
// We don't fail on a numeric threshold. Headless Chrome's frame scheduler
// is too variable across machines for that to be honest. The point is to
// surface the numbers in the test report so a regression is visible. A
// sustained-60fps run logs something like `min=8 avg=17 p95=24 max=48` on a
// typical dev machine.
test.describe("playground: rAF cadence during push (diagnostic)", () => {
  test("samples rAF intervals across one cupertino push", async ({ page }, testInfo) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    await samplePushRafCadence(page, testInfo, "cupertino");
  });

  // blur is a custom transition that animates `filter: blur(...)`, a
  // non-transform property whose compositor promotion is only triggered
  // because `compileTransitionStyles` puts `filter` into the variant's
  // `will-change`. If the compositor promotion ever regresses for
  // author-defined CSS properties, this is the case where it shows up.
  test("samples rAF intervals across one blur push (filter-driven transition)", async ({
    page
  }, testInfo) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);
    await page.getByRole("radio", { name: /blur/i }).click();
    await samplePushRafCadence(page, testInfo, "blur");
  });
});
