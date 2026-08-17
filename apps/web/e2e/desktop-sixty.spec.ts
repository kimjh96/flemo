import { expect, test, type Page } from "@playwright/test";

import { trackConsoleErrors, waitForNavIdle } from "./helpers/flemo";

// Steady-60 desktop routing (steadySixtyCadence.ts): a NON-pinned desktop
// Blink session on a HiDPI display runs its first flights on the compiled
// tier while the in-flight display probe measures the panel; once two
// flights verify a steady-60 cadence the player takes over (with always-snap
// closing the compiled tier's HiDPI convergence shimmer). This spec asserts
// the DEFAULT progression end to end: compiled warm-up → player, and a clean
// landing on the player path.
//
// dpr is emulated at 2 (the device-verified profile); the cadence itself is
// the runner's real rAF clock, so a machine that cannot hold ~60Hz skips.

test.use({ deviceScaleFactor: 2 });

const flightDriverSignature = (page: Page, windowMs: number) =>
  page.evaluate(
    (ms) =>
      new Promise<{ playerFrames: number; compiledFrames: number; transitional: number }>(
        (resolve) => {
          const out = { playerFrames: 0, compiledFrames: 0, transitional: 0 };
          const start = performance.now();
          const loop = () => {
            for (const el of document.querySelectorAll<HTMLElement>("[data-flemo-screen]")) {
              const status = el.getAttribute("data-flemo-status") ?? "";
              if (status !== "PUSHING" && status !== "POPPING" && status !== "REPLACING") continue;
              // Pre-release (anim-hold/park) frames have no driver yet — the
              // compiled hold rules pose the screen while the settle gate
              // waits — so only RELEASED frames identify the tier. (The
              // steady-60 profile turns the settle gate on by default, so
              // eligible flights hold noticeably longer than the warm-up
              // ones.)
              if (el.getAttribute("data-flemo-anim-hold") !== "false") continue;
              out.transitional += 1;
              // Player signature: a non-empty inline animation (the player's
              // `animation: none` suppression — Chromium serializes the
              // shorthand as "auto ease 0s … none", so match non-empty, not
              // the literal). Same signature as motion-perception.spec.ts.
              if (el.style.animation !== "") out.playerFrames += 1;
              else out.compiledFrames += 1;
            }
            if (performance.now() - start < ms) requestAnimationFrame(loop);
            else resolve(out);
          };
          requestAnimationFrame(loop);
        }
      ),
    windowMs
  );

test("a steady-60 HiDPI desktop graduates from compiled warm-up to the player", async ({
  page
}) => {
  test.skip(
    test.info().project.name !== "chromium",
    "the steady-60 carve-out is desktop (non-touch) Blink only"
  );

  const { errors } = trackConsoleErrors(page);
  await page.goto("/playground");
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

  // Cadence health gate: the verdict under test needs the runner to hold a
  // ~60Hz rAF clock. A loaded machine legitimately never verifies (that is
  // the conservative design working) — the property is untestable there.
  const idleMedian = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const gaps: number[] = [];
        let last: number | null = null;
        const tick = (t: number) => {
          if (last !== null) gaps.push(t - last);
          last = t;
          if (gaps.length < 12) requestAnimationFrame(tick);
          else resolve([...gaps].sort((a, b) => a - b)[6]!);
        };
        requestAnimationFrame(tick);
      })
  );
  test.skip(idleMedian > 22, `runner cannot hold 60Hz (idle median ${idleMedian.toFixed(1)}ms)`);
  // The environment decides which HALF of the design this run verifies:
  // headless chromium often runs a SYNTHETIC 120Hz vsync (measured 8.3ms on a
  // machine whose real displays are 60Hz), where the correct behavior is the
  // high-refresh latch — compiled forever. A ~60Hz host (headed on real 60Hz
  // panels, CI's virtual display) verifies the graduation instead.
  const hostIsSteadySixty = idleMedian >= 14;

  await page.getByRole("button", { name: "Cupertino" }).first().click();

  const drivers: string[] = [];
  for (let flight = 0; flight < 8 && !drivers.includes("player"); flight++) {
    const sample = flightDriverSignature(page, 900);
    await page.getByRole("button", { name: flight % 2 === 0 ? "Next" : "Back" }).click();
    const counts = await sample;
    drivers.push(counts.playerFrames > 5 ? "player" : counts.compiledFrames > 5 ? "compiled" : "?");
    await waitForNavIdle(page);
  }

  expect(
    drivers.slice(0, 2),
    "the first two flights must run the compiled warm-up (the probe measures there)"
  ).toEqual(["compiled", "compiled"]);
  if (hostIsSteadySixty) {
    expect(
      drivers,
      `the player must take over once the cadence verifies (saw: ${drivers.join(" → ")})`
    ).toContain("player");
  } else {
    expect(
      drivers,
      `a high-refresh host must latch compiled for the whole session (saw: ${drivers.join(" → ")})`
    ).not.toContain("player");
  }

  // Every flight must land clean: rest pose on-screen, zero residue — the
  // #259 landing contract, on whichever tier the environment routed.
  const landing = await page.evaluate(() => {
    const screens = [...document.querySelectorAll<HTMLElement>("[data-flemo-screen]")];
    const top = screens[screens.length - 1]!;
    return {
      status: top.getAttribute("data-flemo-status"),
      inlineTransform: top.style.transform || "",
      computedTransform: getComputedStyle(top).transform
    };
  });
  expect(landing.inlineTransform).toBe("");
  expect(
    landing.computedTransform === "none" || landing.computedTransform === "matrix(1, 0, 0, 1, 0, 0)"
  ).toBe(true);
  expect(errors).toEqual([]);
});
