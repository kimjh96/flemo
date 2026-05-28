import { test, type Page, type TestInfo } from "@playwright/test";

import { activeScreen, albumTile, waitForTransitionSettled } from "./helpers/flemo";

// Swipe-drag A/B harness. flemo intentionally keeps the swipe-drag path
// main-thread inline (per-pointermove `transform` writes + rAF mirror for
// shared bars) because the screen is being inline-driven during the drag —
// there's no compositor animation to chase. This spec establishes a
// baseline for rAF cadence under an active drag, and measures degradation
// when background CPU contends for the main thread.
//
// Two scenarios per run:
//   - idle: no background work
//   - cpu-busy: setInterval that busy-waits 30ms per 50ms tick (~60% load)
//
// Diagnostic-only — no threshold-based fails. Numbers go to stdout keyed
// by `[swipe-perf]` so a future compositor-driven drag (or a regression in
// the current rAF path) shows up as a clear delta.

interface DragScenario {
  label: "idle" | "cpu-busy";
  injectBackgroundCpu: boolean;
}

const scenarios: DragScenario[] = [
  { label: "idle", injectBackgroundCpu: false },
  { label: "cpu-busy", injectBackgroundCpu: true }
];

async function measureDrag(page: Page, testInfo: TestInfo, scenario: DragScenario) {
  await page.goto("/playground");
  await waitForTransitionSettled(page);

  // Push to Album so cupertino swipe-back is available from a non-root.
  await albumTile(page, 0).click();
  await waitForTransitionSettled(page);

  const scope = activeScreen(page);
  const box = await scope.boundingBox();
  if (!box) throw new Error("active screen has no bounding box");

  // Arm the rAF sampler + background CPU work inside the page.
  await page.evaluate(({ injectBackgroundCpu }) => {
    interface DragWindow {
      __flemoDragStop: () => { samples: number[]; backgroundTicks: number };
      __flemoBgInterval?: number;
    }
    const w = window as unknown as DragWindow & Window;

    const samples: number[] = [];
    let running = true;
    let last = performance.now();
    let backgroundTicks = 0;

    const tick = (now: number) => {
      samples.push(now - last);
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame((now) => {
      last = now;
      requestAnimationFrame(tick);
    });

    if (injectBackgroundCpu) {
      w.__flemoBgInterval = window.setInterval(() => {
        const until = performance.now() + 30;
        while (performance.now() < until) {
          // busy-wait
        }
        backgroundTicks += 1;
      }, 50);
    }

    w.__flemoDragStop = () => {
      running = false;
      if (w.__flemoBgInterval !== undefined) {
        clearInterval(w.__flemoBgInterval);
        w.__flemoBgInterval = undefined;
      }
      return { samples, backgroundTicks };
    };
  }, scenario);

  // Start the drag near the left edge of the active screen and pull it
  // rightward by ~70% of viewport — well past the commit threshold so the
  // pop actually fires on release. Spread the move across 20 steps over
  // ~400ms so the drag is observed under sustained pointer motion, not a
  // single instant jump.
  const startX = box.x + 10;
  const startY = box.y + box.height / 2;
  const endX = box.x + box.width * 0.7;
  const endY = startY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Wait a beat to let pointerdown actually arm the drag state.
  await page.waitForTimeout(20);

  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(startX + (endX - startX) * t, startY + (endY - startY) * t);
    await page.waitForTimeout(15);
  }

  await page.mouse.up();

  // Let either the commit-pop animation or the cancel-back animation run.
  await page.waitForTimeout(700);
  await page.waitForTimeout(100);

  const { samples, backgroundTicks } = await page.evaluate(() => {
    interface DragWindow {
      __flemoDragStop: () => { samples: number[]; backgroundTicks: number };
    }
    return (window as unknown as DragWindow).__flemoDragStop();
  });

  const deltas = samples.slice(1);
  const sorted = [...deltas].sort((a, b) => a - b);
  const sum = deltas.reduce((acc, d) => acc + d, 0);
  const avg = deltas.length > 0 ? sum / deltas.length : 0;
  const min = deltas.length > 0 ? sorted[0]! : 0;
  const max = deltas.length > 0 ? sorted[sorted.length - 1]! : 0;
  const p95 = deltas.length > 0 ? sorted[Math.floor(sorted.length * 0.95)]! : 0;
  const long32 = deltas.filter((d) => d > 32).length;
  const long50 = deltas.filter((d) => d > 50).length;

  const summary =
    `${scenario.label.padEnd(8)}: ` +
    `samples=${deltas.length} ` +
    `min=${min.toFixed(1)}ms avg=${avg.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms ` +
    `long(>32ms)=${long32} long(>50ms)=${long50} ` +
    `bgTicks=${backgroundTicks}`;

  testInfo.annotations.push({ type: "swipe-perf", description: summary });
  // eslint-disable-next-line no-console
  console.log(`[swipe-perf] ${summary}`);
}

test.describe("playground — swipe-drag rAF cadence (diagnostic)", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 30_000, navigationTimeout: 30_000 });

  for (const scenario of scenarios) {
    test(scenario.label, async ({ page }, testInfo) => {
      await measureDrag(page, testInfo, scenario);
    });
  }
});
