import { expect, test, type Page } from "@playwright/test";

import { trackConsoleErrors, waitForNavIdle } from "./helpers/flemo";

// Steady-60 desktop contract (steadySixtyCadence.ts + the engine's desktop
// gate): a NON-pinned desktop Blink session runs the COMPILED compositor tier
// for every flight — the settled verdict of the 2026-08-18 live-judged
// ladder. The in-flight display probe still measures the panel, but its
// verdict only arms desktop-profile DEFAULTS (settle gate, image hold,
// compositor warm-up); it never routes the player. So the assertion here is
// cadence-independent: whatever the runner's clock (real 60Hz panels, CI's
// virtual display, headless chromium's synthetic 120Hz vsync), the driver
// must be compiled on every flight, and every flight must land clean.
//
// dpr is emulated at 2 (the device-verified profile the campaign judged on).

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
              // waits — so only RELEASED frames identify the tier.
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

test("a HiDPI desktop session stays on the compiled tier for every flight", async ({ page }) => {
  test.skip(
    test.info().project.name !== "chromium",
    "the desktop-Blink contract is non-touch Blink only"
  );

  const { errors } = trackConsoleErrors(page);
  await page.goto("/playground");
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Cupertino" }).first().click();

  const drivers: string[] = [];
  for (let flight = 0; flight < 6; flight++) {
    const sample = flightDriverSignature(page, 900);
    await page.getByRole("button", { name: flight % 2 === 0 ? "Next" : "Back" }).click();
    const counts = await sample;
    drivers.push(counts.playerFrames > 5 ? "player" : counts.compiledFrames > 5 ? "compiled" : "?");
    await waitForNavIdle(page);
  }

  // Six flights span the probe's measuring window and everything after a
  // verdict could land — the driver must never flip, on any host cadence.
  expect(
    drivers.filter((driver) => driver !== "?"),
    `every released flight must run compiled (saw: ${drivers.join(" → ")})`
  ).toEqual(drivers.filter((driver) => driver !== "?").map(() => "compiled"));
  expect(
    drivers.filter((driver) => driver === "compiled").length,
    `at least half the flights must present a released compiled window (saw: ${drivers.join(" → ")})`
  ).toBeGreaterThanOrEqual(3);

  // Every flight must land clean: rest pose on-screen, zero residue — the
  // #259 landing contract.
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
