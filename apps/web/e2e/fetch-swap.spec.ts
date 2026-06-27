import { test, type Page, type TestInfo } from "@playwright/test";

import { waitForTransitionSettled } from "./helpers/flemo";

// Reproduces the WebKit "abbreviated transition" report: a screen is pushed
// showing a skeleton, then an async fetch resolves MID-ANIMATION and swaps in
// heavy content. The swapped subtree repaints inside the still-sliding
// `data-flemo-screen` scope, which is the layer the `transform` keyframe
// animates. On WebKit the layer's backing-store re-raster stalls presentation,
// so the slide skips ahead and lands late; on Chromium the slide stays smooth
// and the content just pops in when ready.
//
// This spec is OPT-IN (gated on FLEMO_WEBKIT) because CI's Playwright job only
// installs chromium. Run it locally against both engines:
//
//   pnpm --filter @flemo/web exec playwright install webkit
//   FLEMO_WEBKIT=1 pnpm --filter @flemo/web exec playwright test fetch-swap
//
// Two evidence layers:
//   1. Video artifact per engine (the presentation proof you watch / filmstrip).
//   2. A structured `[fetch-swap]` log: rAF cadence + long-animation-frames +
//      the transform timeline sampled per frame. The timeline (read via
//      getComputedStyle) advances on the animation clock regardless of what the
//      compositor actually presents, so it proves (a) the swap lands inside the
//      push window and (b) the keyframe is NOT restarting — it's presentation,
//      not React, that hitches. Main-thread stalls show up as rAF/LoAF spikes.

const RUN = !!process.env.FLEMO_WEBKIT;

// Record video so the slide can be eyeballed / turned into a filmstrip.
// Must be top-level (a `video` option inside a describe forces a new worker
// and Playwright rejects it).
test.use({
  viewport: { width: 1280, height: 800 },
  video: { mode: "on", size: { width: 1280, height: 800 } }
});

interface Sample {
  t: number;
  tx: number; // translateX (px) parsed from the scope's computed transform
}

// Pull translateX out of a computed `transform` matrix string.
function translateXOf(transform: string): number {
  if (!transform || transform === "none") return 0;
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (matrix) {
    const parts = matrix[1].split(",").map((n) => parseFloat(n.trim()));
    return parts[4] ?? 0; // e component
  }
  const matrix3d = transform.match(/matrix3d\(([^)]+)\)/);
  if (matrix3d) {
    const parts = matrix3d[1].split(",").map((n) => parseFloat(n.trim()));
    return parts[12] ?? 0;
  }
  return 0;
}

async function measure(page: Page, testInfo: TestInfo, testid: string) {
  await page.goto("/playground");
  await waitForTransitionSettled(page);

  const viewportWidth = page.viewportSize()?.width ?? 0;

  // Arm the in-page samplers before the push.
  await page.evaluate(() => {
    type LongFrame = { duration: number; startTime: number };
    const samples: { t: number; transform: string }[] = [];
    const longFrames: LongFrame[] = [];
    let running = true;

    const readActiveTransform = () => {
      const scope = document.querySelector('[data-flemo-screen][data-flemo-active="true"]');
      if (!scope) return "none";
      return getComputedStyle(scope).transform;
    };

    const tick = (now: number) => {
      samples.push({ t: now, transform: readActiveTransform() });
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longFrames.push({ duration: entry.duration, startTime: entry.startTime });
        }
      });
      observer.observe({ type: "long-animation-frame", buffered: true } as PerformanceObserverInit);
    } catch {
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longFrames.push({ duration: entry.duration, startTime: entry.startTime });
          }
        });
        observer.observe({ entryTypes: ["longtask"] });
      } catch {
        // no observer available
      }
    }

    (
      window as unknown as {
        __fsStop: () => {
          samples: { t: number; transform: string }[];
          longFrames: LongFrame[];
          clickAt: number | null;
          swapAt: number | null;
        };
        __fsMarkClick: () => void;
      }
    ).__fsStop = () => {
      running = false;
      observer?.disconnect();
      const clickMark = performance.getEntriesByName("flemo-click")[0];
      const swapMark = performance.getEntriesByName("flemo-fetch-swap")[0];
      return {
        samples,
        longFrames,
        clickAt: clickMark ? clickMark.startTime : null,
        swapAt: swapMark ? swapMark.startTime : null
      };
    };
    (window as unknown as { __fsMarkClick: () => void }).__fsMarkClick = () => {
      performance.mark("flemo-click");
    };
  });

  await page.evaluate(() => (window as unknown as { __fsMarkClick: () => void }).__fsMarkClick());
  await page.getByTestId(testid).click();
  await waitForTransitionSettled(page);
  // Stamp the settle time before the tail wait. The analysis window is
  // [click, settled] = the slide itself. For `deferred`, the heavy swap fires
  // at COMPLETED (≈ settled), so its raster spike lands at/after this mark and
  // is excluded — exactly the point: was the SLIDE smooth?
  const settledAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(150); // let the tail rAF samples land

  const raw = await page.evaluate(() =>
    (
      window as unknown as {
        __fsStop: () => {
          samples: { t: number; transform: string }[];
          longFrames: { duration: number; startTime: number }[];
          clickAt: number | null;
          swapAt: number | null;
        };
      }
    ).__fsStop()
  );

  const project = testInfo.project.name;
  const clickAt = raw.clickAt ?? 0;
  const swapAt = raw.swapAt;

  // Slide window = [click, end]. For `deferred`, the swap fires at COMPLETED
  // (≈ settled); since `settledAt` is stamped after Playwright observes the
  // status flip — which can be a beat after the post-completion raster begins —
  // bound the window at the swap mark (set in a layout effect, BEFORE that
  // raster) so the deferred raster is excluded. The question for deferred is
  // strictly "was the SLIDE smooth", and the slide is over by the mark.
  const deferred = testid.includes("deferred");
  const windowEnd = deferred && swapAt !== null ? Math.min(settledAt, swapAt) : settledAt;
  const windowSamples: Sample[] = raw.samples
    .filter((s) => s.t >= clickAt && s.t <= windowEnd)
    .map((s) => ({ t: s.t, tx: translateXOf(s.transform) }));

  // Per-consecutive-frame deltas.
  let maxDt = 0;
  let maxDtxPx = 0;
  let frames32 = 0;
  let frames50 = 0;
  let swapFrameDt = 0;
  let swapFrameDtxPx = 0;
  for (let i = 1; i < windowSamples.length; i++) {
    const dt = windowSamples[i].t - windowSamples[i - 1].t;
    const dtx = Math.abs(windowSamples[i].tx - windowSamples[i - 1].tx);
    if (dt > maxDt) maxDt = dt;
    if (dtx > maxDtxPx) maxDtxPx = dtx;
    if (dt > 32) frames32++;
    if (dt > 50) frames50++;
    // The frame interval that straddles the content swap is the one we care
    // about most: it's where a presentation stall would manifest.
    if (swapAt !== null && windowSamples[i - 1].t <= swapAt && windowSamples[i].t >= swapAt) {
      swapFrameDt = dt;
      swapFrameDtxPx = dtx;
    }
  }

  const loaInWindow = raw.longFrames.filter((f) => f.startTime + f.duration >= clickAt);
  const loaTotal = loaInWindow.reduce((acc, f) => acc + f.duration, 0);
  const loaMax = loaInWindow.reduce((acc, f) => Math.max(acc, f.duration), 0);

  const pct = (px: number) => (viewportWidth > 0 ? ((px / viewportWidth) * 100).toFixed(1) : "?");
  const swapRel = swapAt !== null ? (swapAt - clickAt).toFixed(0) : "n/a";

  const summary =
    `${project.padEnd(8)} ${testid}: ` +
    `swapAt=+${swapRel}ms frames=${windowSamples.length} ` +
    `maxFrameGap=${maxDt.toFixed(1)}ms (>32:${frames32} >50:${frames50}) ` +
    `maxTxJump=${maxDtxPx.toFixed(0)}px(${pct(maxDtxPx)}%) ` +
    `swapFrame[gap=${swapFrameDt.toFixed(1)}ms txJump=${swapFrameDtxPx.toFixed(0)}px(${pct(
      swapFrameDtxPx
    )}%)] ` +
    `LoAF[total=${loaTotal.toFixed(0)}ms max=${loaMax.toFixed(0)}ms]`;

  testInfo.annotations.push({ type: "fetch-swap", description: summary });
  // eslint-disable-next-line no-console
  console.log(`[fetch-swap] ${summary}`);
}

test.describe("playground: fetch-swap mid-animation (WebKit repro)", () => {
  test.skip(!RUN, "Set FLEMO_WEBKIT=1 to run (needs the webkit project + browser).");
  test.describe.configure({ mode: "serial" });

  for (const testid of [
    "fetch-swap-push-now-150-1500",
    "fetch-swap-push-now-300-1500",
    "fetch-swap-push-deferred-150-1500",
    "fetch-swap-push-deferred-300-1500"
  ]) {
    test(testid, async ({ page }, testInfo) => {
      // Desktop chromium vs webkit is the comparison; skip the mobile preset.
      test.skip(testInfo.project.name === "mobile-chromium", "desktop comparison only");
      await measure(page, testInfo, testid);
    });
  }
});
