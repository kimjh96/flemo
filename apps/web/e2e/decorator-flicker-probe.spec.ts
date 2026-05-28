import { test, expect, type Page, type TestInfo } from "@playwright/test";

import { waitForTransitionSettled } from "./helpers/flemo";

// Decorator opacity contract pin. The overlay decorator animates idle→enter
// over 0.3s, holds at `enter` (opacity 1) via `fill: both` until the screen's
// 0.7s cupertino animation also settles, then hands off to the COMPLETED-false
// rest rule (also at `enter`'s values). The contract is: once the rising-edge
// window is past, opacity must never dip below 1 — no race between the
// animation handoff and the rest rule taking over.
//
// Born from an investigation into a reported Android / iOS flicker
// ("opacity animates 0→1, then drops to 0 at the end of the transition").
// The flicker did NOT reproduce in any local environment we can drive —
// chromium desktop, mobile-chromium emulation, or chromium under 6× CPU
// throttle. The compiled CSS handoff stays solid in all four. The spec
// stays so any future change that DOES dip the painted opacity (e.g., a
// keyframe `to` that no longer matches the rest rule, a will-change
// release pushed into the hold window) shows up as a failure here, and
// so the per-frame curve is logged for visual inspection.
//
// Real-device verification (BrowserStack / hardware) is the only way to
// settle the original Android/iOS report; this guard does not substitute
// for that.

interface Sample {
  t: number;
  opacity: number;
  bgAlpha: number;
  status: string | null;
  active: string | null;
}

async function probeDecorator(page: Page, testInfo: TestInfo) {
  await page.goto("/playground");
  await waitForTransitionSettled(page);

  // Push to Album so the Library screen becomes the "going-behind" one
  // and its decorator animates idle → enter.
  await page.evaluate(() => performance.mark("flemo-click"));

  await Promise.all([
    page.locator("button:has(.aspect-square)").first().click(),
    // Arm the sampler in parallel with the click so the first frame is
    // captured. We use page.evaluate not addInitScript because we only
    // want sampling for this one transition.
    page.evaluate(() => {
      interface ProbeWindow extends Window {
        __flemoProbeStop?: () => Sample[];
      }
      interface Sample {
        t: number;
        opacity: number;
        bgAlpha: number;
        status: string | null;
        active: string | null;
      }
      const samples: Sample[] = [];
      let running = true;
      const start = performance.now();

      // The "going-behind" screen — the one that was active before the
      // push, now sitting behind the new active screen. Its decorator is
      // the one animating idle→enter.
      const findDecorator = (): HTMLElement | null => {
        const decorators = document.querySelectorAll<HTMLElement>(
          '[data-flemo-decorator][data-flemo-decorator-name="overlay"]'
        );
        for (const el of decorators) {
          const active = el.getAttribute("data-flemo-active");
          const status = el.getAttribute("data-flemo-status");
          if (active === "false" && status === "PUSHING") return el;
        }
        // Fall back to whichever overlay decorator is around (e.g., after
        // status flips to COMPLETED-false).
        for (const el of decorators) {
          if (el.getAttribute("data-flemo-active") === "false") return el;
        }
        return decorators[0] ?? null;
      };

      const tick = () => {
        if (!running) return;
        const el = findDecorator();
        if (el) {
          const style = getComputedStyle(el);
          const opacity = Number(style.opacity);
          const bg = style.backgroundColor;
          const rgbaMatch = bg.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*([\d.]+))?\s*\)/);
          const bgAlpha = rgbaMatch ? (rgbaMatch[1] ? Number(rgbaMatch[1]) : 1) : NaN;
          samples.push({
            t: performance.now() - start,
            opacity,
            bgAlpha,
            status: el.getAttribute("data-flemo-status"),
            active: el.getAttribute("data-flemo-active")
          });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      (window as ProbeWindow).__flemoProbeStop = () => {
        running = false;
        return samples;
      };
    })
  ]);

  await waitForTransitionSettled(page);
  // Hang a beat so the tail samples land.
  await page.waitForTimeout(100);

  const samples = await page.evaluate(() => {
    interface ProbeWindow extends Window {
      __flemoProbeStop?: () => Sample[];
    }
    interface Sample {
      t: number;
      opacity: number;
      bgAlpha: number;
      status: string | null;
      active: string | null;
    }
    return (window as ProbeWindow).__flemoProbeStop?.() ?? [];
  });

  // Bucket the samples by 50ms windows so the log is readable.
  const bucketed: Record<string, Sample[]> = {};
  for (const s of samples) {
    const bucket = `${Math.floor(s.t / 50) * 50}-${Math.floor(s.t / 50) * 50 + 50}`;
    (bucketed[bucket] ??= []).push(s);
  }

  // Detection heuristics — flag any sample where opacity is between 0.01
  // and 0.99 outside the rising-edge window (t < 350ms allows for the
  // 0.3s animation + a 50ms tolerance). Also flag any sample where
  // status="PUSHING" but opacity == 0 after t=50ms (the held window
  // should be opacity ~1, never back to 0).
  const suspect: Sample[] = [];
  for (const s of samples) {
    if (s.status === "PUSHING" && s.t > 350 && s.opacity < 0.95) {
      suspect.push(s);
    }
    if (s.status === "COMPLETED" && s.active === "false" && s.opacity < 0.95) {
      suspect.push(s);
    }
  }

  const lines: string[] = [];
  lines.push(`[decorator-probe] total samples: ${samples.length}`);
  lines.push(`[decorator-probe] suspect samples: ${suspect.length}`);

  if (suspect.length > 0) {
    lines.push("[decorator-probe] SUSPECT:");
    for (const s of suspect.slice(0, 12)) {
      lines.push(
        `[decorator-probe]   t=${s.t.toFixed(0).padStart(4)}ms ` +
          `status=${s.status} active=${s.active} ` +
          `opacity=${s.opacity.toFixed(3)} bgAlpha=${s.bgAlpha.toFixed(3)}`
      );
    }
    if (suspect.length > 12) {
      lines.push(`[decorator-probe]   ...and ${suspect.length - 12} more`);
    }
  }

  // Coarse curve trace — one line per ~50ms bucket showing the median
  // opacity and the current status. Lets us eyeball "rising, held flat,
  // settled" in one glance.
  lines.push("[decorator-probe] curve (50ms buckets):");
  for (const [bucket, group] of Object.entries(bucketed)) {
    const med = [...group].sort((a, b) => a.opacity - b.opacity)[Math.floor(group.length / 2)]!
      .opacity;
    const minO = Math.min(...group.map((g) => g.opacity));
    const statuses = Array.from(new Set(group.map((g) => g.status))).join("|");
    lines.push(
      `[decorator-probe]   ${bucket.padStart(10)} ms — ` +
        `opacity median=${med.toFixed(3)} min=${minO.toFixed(3)} status=${statuses}`
    );
  }

  const report = lines.join("\n");
  testInfo.annotations.push({ type: "decorator-probe", description: report });
  // eslint-disable-next-line no-console
  console.log(report);

  // Pin the contract: zero frames where the held opacity dips below 0.95
  // after the rising edge (t > 350ms), and zero frames where COMPLETED-false
  // shows opacity < 0.95. A future change that breaks the animation→rest
  // handoff fails here on the local renderer; a regression that only
  // manifests on a real device still needs hardware to surface.
  expect(suspect, "decorator opacity dipped below 0.95 inside the hold window").toEqual([]);
}

test.describe("playground — decorator opacity probe (diagnostic)", () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 30_000 });

  test("push from Library to Album — sample overlay opacity per rAF", async ({
    page
  }, testInfo) => {
    await probeDecorator(page, testInfo);
  });

  test("push with 6x CPU throttling — does the tight timing expose a race?", async ({
    page
  }, testInfo) => {
    // CDP CPU throttle. 6x is roughly a mid-range Android of a few years
    // ago — tight enough that style recalc / compositor scheduling gets
    // visibly stressed but not so heavy that the test hangs.
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await probeDecorator(page, testInfo);
    await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  });
});
