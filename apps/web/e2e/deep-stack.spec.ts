import { test, type Page, type TestInfo } from "@playwright/test";

import { waitForTransitionSettled } from "./helpers/flemo";

// Deep-stack stress: catches O(n) regressions in flemo's render loop and
// memory growth on accumulated screen stacks. Push 10 heavy screens onto
// the stack (each via the destination's own "Push another" button so
// every push lands on a fresh mount, not a frozen replay), then pop back
// through all 10. flipLatency, DOM size, and JS heap (Chromium-only) are
// recorded per step so we can spot linear growth or step changes.
//
// Diagnostic-only (no threshold-based fails). Numbers are logged keyed by
// `[deep-stack] push N=k` so before/after comparison is mechanical.

const STACK_DEPTH = 10;

interface PerStepMeasurement {
  step: number;
  flipLatencyMs: number;
  domNodeCount: number;
  jsHeapMb: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
}

async function clickAndMeasure(
  page: Page,
  triggerLocator: ReturnType<Page["getByTestId"]> | ReturnType<Page["getByLabel"]>
): Promise<{ flipLatencyMs: number; domNodeCount: number; jsHeapMb: number }> {
  await page.evaluate(() => performance.mark("flemo-step-click"));
  await triggerLocator.click();
  await waitForTransitionSettled(page);
  return page.evaluate(() => {
    const mark = performance.getEntriesByName("flemo-step-click").at(-1);
    const flipLatencyMs = mark ? performance.now() - mark.startTime : -1;
    const domNodeCount = document.querySelectorAll("*").length;
    const perf = performance as Performance & { memory?: MemoryInfo };
    const jsHeapMb = perf.memory ? perf.memory.usedJSHeapSize / 1048576 : -1;
    performance.clearMarks("flemo-step-click");
    return { flipLatencyMs, domNodeCount, jsHeapMb };
  });
}

async function runDeepStack(page: Page, testInfo: TestInfo) {
  await page.goto("/playground");
  await waitForTransitionSettled(page);

  const pushes: PerStepMeasurement[] = [];
  const pops: PerStepMeasurement[] = [];

  // Step 1: kick off the stack from Library via the Light preset.
  const first = await clickAndMeasure(page, page.getByTestId("perf-push-0-50"));
  pushes.push({ step: 1, ...first });

  // Steps 2..N: each heavy screen exposes a "Push another" button that
  // pushes the same route onto the top of the stack. Each press lands on
  // a fresh mount of HeavyArrivalScreen.
  for (let i = 1; i < STACK_DEPTH; i++) {
    const m = await clickAndMeasure(page, page.getByTestId("perf-push-next").last());
    pushes.push({ step: i + 1, ...m });
  }

  // Pop back through all 10. Each screen's app bar has the Back button.
  // `last()` is irrelevant here because only the active (top) screen is
  // visible/interactive, but using it makes the locator deterministic.
  for (let i = 0; i < STACK_DEPTH; i++) {
    const m = await clickAndMeasure(page, page.getByLabel("Back").last());
    pops.push({ step: STACK_DEPTH - i, ...m });
  }

  const fmt = (rows: PerStepMeasurement[], label: string) =>
    rows
      .map(
        (r) =>
          `[deep-stack] ${label} N=${String(r.step).padStart(2)} ` +
          `flipLatency=${r.flipLatencyMs.toFixed(0).padStart(4)}ms ` +
          `dom=${String(r.domNodeCount).padStart(5)} ` +
          `heap=${r.jsHeapMb.toFixed(1)}MB`
      )
      .join("\n");

  const report = `${fmt(pushes, "push")}\n${fmt(pops, "pop ")}`;
  testInfo.annotations.push({ type: "deep-stack", description: report });
  // eslint-disable-next-line no-console
  console.log(report);
}

test.describe("playground: deep stack stress (diagnostic)", () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 30_000 });

  test("push 10 + pop 10: flipLatency / DOM / heap per step", async ({ page }, testInfo) => {
    await runDeepStack(page, testInfo);
  });
});
