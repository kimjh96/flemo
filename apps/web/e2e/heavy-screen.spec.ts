import { test, type Page, type TestInfo } from "@playwright/test";

import { waitForTransitionSettled } from "./helpers/flemo";

// A/B harness for compositor / containment / scheduling optimizations.
// Same flow for every scenario:
//   1. Land on /playground, settle
//   2. Arm three observers in one page.evaluate:
//        - rAF deltas (compositor cadence)
//        - PerformanceObserver("long-animation-frame") (>50ms main-thread blocks)
//        - performance.mark for click time
//   3. Click the perf-push button
//   4. Wait until `data-flemo-status="COMPLETED"` flips, mark settle time
//   5. Drain & log one structured summary per scenario
//
// No threshold-based fails — these are diagnostic. Numbers go to stdout
// keyed by `[heavy-perf] <scenario> ...` so before/after diffing is
// mechanical (grep, paste).

interface Scenario {
  label: string;
  cpuMs: number;
  nodes: number;
}

const scenarios: Scenario[] = [
  { label: "light", cpuMs: 0, nodes: 50 },
  { label: "cpu-120ms", cpuMs: 120, nodes: 50 },
  { label: "tree-2k", cpuMs: 0, nodes: 2000 },
  { label: "cpu+tree", cpuMs: 120, nodes: 2000 }
];

type Verb = "push" | "pop";

async function measureScenario(
  page: Page,
  testInfo: TestInfo,
  scenario: Scenario,
  options: { disableOpts?: boolean; verb?: Verb } = {}
) {
  const verb: Verb = options.verb ?? "push";

  await page.goto("/playground");
  if (options.disableOpts) {
    // Nullify the compiled `contain: layout` + `pointer-events: none`
    // declarations so we can A/B them at runtime without rebuilding the
    // library. Targets the exact selector pair the compiler emits.
    await page.addStyleTag({
      content: `
        [data-flemo-screen][data-flemo-status="PUSHING"],
        [data-flemo-screen][data-flemo-status="POPPING"],
        [data-flemo-screen][data-flemo-status="REPLACING"],
        [data-flemo-bar][data-flemo-bar-status="PUSHING"],
        [data-flemo-bar][data-flemo-bar-status="POPPING"],
        [data-flemo-bar][data-flemo-bar-status="REPLACING"],
        [data-flemo-decorator][data-flemo-status="PUSHING"],
        [data-flemo-decorator][data-flemo-status="POPPING"],
        [data-flemo-decorator][data-flemo-status="REPLACING"] {
          contain: none !important;
          pointer-events: auto !important;
        }
      `
    });
  }
  await waitForTransitionSettled(page);

  // For pop, set up by pushing to the heavy screen first so we have something
  // to pop back from. The setup push is NOT measured — we arm the rAF/LoAF
  // observers AFTER the setup settles, then click back.
  if (verb === "pop") {
    await page.getByTestId(`perf-push-${scenario.cpuMs}-${scenario.nodes}`).click();
    await waitForTransitionSettled(page);
  }

  await page.evaluate(() => {
    window.__flemoHeavyRenderCount = 0;
  });

  await page.evaluate(() => {
    type LongFrame = { duration: number; startTime: number };
    const samples: number[] = [];
    const longFrames: LongFrame[] = [];
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

    // long-animation-frame is the modern, attributable replacement for
    // long-tasks (still experimental but supported in Chrome 123+). Each
    // entry is a frame whose main-thread work exceeded 50ms.
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longFrames.push({ duration: entry.duration, startTime: entry.startTime });
        }
      });
      observer.observe({
        type: "long-animation-frame",
        buffered: true
      } as PerformanceObserverInit);
    } catch {
      // Fall back to long-task if LoAF isn't supported.
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longFrames.push({ duration: entry.duration, startTime: entry.startTime });
          }
        });
        observer.observe({ entryTypes: ["longtask"] });
      } catch {
        // No observer available — keep going, longFrames stays empty.
      }
    }

    (
      window as unknown as {
        __flemoStop: () => {
          samples: number[];
          longFrames: LongFrame[];
          clickAt: number | null;
        };
        __flemoMarkClick: () => void;
      }
    ).__flemoStop = () => {
      running = false;
      observer?.disconnect();
      const clickMark = performance.getEntriesByName("flemo-click")[0];
      return {
        samples,
        longFrames,
        clickAt: clickMark ? clickMark.startTime : null
      };
    };
    (window as unknown as { __flemoMarkClick: () => void }).__flemoMarkClick = () => {
      performance.mark("flemo-click");
    };
  });

  // Mark click time inside the page so it sits on the same monotonic clock
  // as the rAF samples — Playwright's wall-clock has skew vs page time.
  await page.evaluate(() =>
    (window as unknown as { __flemoMarkClick: () => void }).__flemoMarkClick()
  );

  if (verb === "push") {
    await page.getByTestId(`perf-push-${scenario.cpuMs}-${scenario.nodes}`).click();
  } else {
    // pop: trigger the AppBar back button on the heavy screen. `exact` so it
    // doesn't also match the panel's "backgroundColor" control (substring).
    await page.getByLabel("Back", { exact: true }).click();
  }

  await waitForTransitionSettled(page);
  const settledAt = await page.evaluate(() => performance.now());
  // Give the post-transition idle a beat so the tail rAF samples land.
  await page.waitForTimeout(80);

  const { samples, longFrames, clickAt } = await page.evaluate(() =>
    (
      window as unknown as {
        __flemoStop: () => {
          samples: number[];
          longFrames: { duration: number; startTime: number }[];
          clickAt: number | null;
        };
      }
    ).__flemoStop()
  );

  const deltas = samples.slice(1);
  const sorted = [...deltas].sort((a, b) => a - b);
  const sum = deltas.reduce((acc, d) => acc + d, 0);
  const avg = deltas.length > 0 ? sum / deltas.length : 0;
  const min = deltas.length > 0 ? sorted[0]! : 0;
  const max = deltas.length > 0 ? sorted[sorted.length - 1]! : 0;
  const p95 = deltas.length > 0 ? sorted[Math.floor(sorted.length * 0.95)]! : 0;
  const long32 = deltas.filter((d) => d > 32).length;

  const flipLatencyMs = clickAt !== null ? settledAt - clickAt : -1;
  const renderCount = await page.evaluate(() => window.__flemoHeavyRenderCount ?? 0);

  // Long-animation-frame entries that overlap the transition window
  // (click → settled) are the ones that actually blocked the user-facing
  // transition. Filter to that band so noise from earlier page setup
  // doesn't pollute the signal.
  const transitionLoaFs =
    clickAt !== null
      ? longFrames.filter((f) => f.startTime + f.duration >= clickAt && f.startTime <= settledAt)
      : longFrames;
  const loaCount = transitionLoaFs.length;
  const loaTotalMs = transitionLoaFs.reduce((acc, f) => acc + f.duration, 0);
  const loaMaxMs = transitionLoaFs.reduce((acc, f) => Math.max(acc, f.duration), 0);

  const tag = options.disableOpts ? "[no-opts]" : "[opts]   ";
  const summary =
    `${tag} ${verb.padEnd(7)} ${scenario.label}: ` +
    `flipLatency=${flipLatencyMs.toFixed(0)}ms ` +
    `renders=${renderCount} ` +
    `samples=${deltas.length} ` +
    `min=${min.toFixed(1)}ms avg=${avg.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms ` +
    `long(>32ms)=${long32} ` +
    `LoAF[n=${loaCount} total=${loaTotalMs.toFixed(0)}ms max=${loaMaxMs.toFixed(0)}ms]`;

  testInfo.annotations.push({ type: "heavy-perf", description: summary });
  // eslint-disable-next-line no-console
  console.log(`[heavy-perf] ${summary}`);
}

test.describe("playground — heavy arrival screen (diagnostic A/B harness)", () => {
  // Single-project sequential run keeps the numbers comparable across
  // scenarios. The 2k-node scenarios block React commit long enough to
  // bust the default 5s action timeout, so bump it for this suite.
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 30_000, navigationTimeout: 30_000 });

  for (const verb of ["push", "pop"] as const) {
    for (const scenario of scenarios) {
      test(`${verb} ${scenario.label} [no-opts]`, async ({ page }, testInfo) => {
        await measureScenario(page, testInfo, scenario, { disableOpts: true, verb });
      });
      test(`${verb} ${scenario.label} [opts]`, async ({ page }, testInfo) => {
        await measureScenario(page, testInfo, scenario, { disableOpts: false, verb });
      });
    }
  }
});
