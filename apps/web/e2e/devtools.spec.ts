import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

import type { FlemoReport } from "@flemo/devtools";

// @flemo/devtools flight recorder: armed via /playground?devtools=on, read
// back through window.flemo.report().
//
// Desktop-chromium only. At deviceScaleFactor 1 (Playwright's Desktop Chrome
// default) desktop Blink routes navigations to the COMPILED tier
// deterministically, so asserting driver "compiled" is stable here. Do NOT
// port that assertion to other projects or DPRs blindly: the in-flight
// "steady-60" routing work lets desktop Blink promote the PLAYER on HiDPI
// displays after verified 60Hz flights — the recorder detects the tier per
// flight from the DOM signature, so on such sessions the detected driver is
// the assertion target, not a hardcoded "compiled".
test.describe("devtools flight recorder", () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "desktop chromium only: compiled routing is deterministic at deviceScaleFactor 1"
    );
  });

  test("records a cupertino push as a clean compiled flight", async ({ page }) => {
    await page.goto("/playground?devtools=on");
    await waitForNavIdle(page);

    // The default transition is Cupertino; "Next" pushes the next panel.
    await page.getByRole("button", { name: "Next" }).click();
    await waitForNavIdle(page);
    // Let the landing audit (+2 rAF) and any trailing long tasks settle.
    await page.waitForTimeout(250);

    const report = (await page.evaluate(() =>
      (window as unknown as { flemo: { report: () => unknown } }).flemo.report()
    )) as FlemoReport;

    expect(report.version).toBe("1");
    expect(report.blindSpots.length).toBeGreaterThanOrEqual(4);
    expect(report.flights.length).toBeGreaterThanOrEqual(1);

    const push = report.flights.find((flight) => flight.kind === "PUSH");
    expect(push).toBeDefined();
    // Desktop chromium at deviceScaleFactor 1 routes compiled (see header).
    expect(push?.driver).toBe("compiled");
    // Sane duration: longer than a frame, shorter than a stuck queue.
    expect(push?.durationMs).toBeGreaterThan(100);
    expect(push?.durationMs).toBeLessThan(5000);
    // No blank-viewport-class landing anomalies.
    expect(push?.landing.offViewportAtRest).toBe(false);
    expect(push?.anomalies.filter((entry) => entry.includes("blank-viewport"))).toEqual([]);
    expect(report.anomalies.filter((entry) => entry.includes("blank-viewport"))).toEqual([]);

    // The report is fully JSON-serializable (it crossed page.evaluate) and
    // self-describing.
    expect(report.environment.engine).toBe("blink");
    expect(report.driverPolicy).toHaveProperty("forcePin");
  });

  test("a residual driver force pin set before load surfaces as a warning", async ({ page }) => {
    // A bogus (unstamped, legacy-format) pin: exactly the residue that once
    // burned a multi-day investigation. Core strips it on its first driver
    // decision, so only the recorder's attach-time snapshot can preserve it.
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("flemo:motion-driver-force", "raf");
      } catch {
        // Storage unavailable: the test will fail loudly downstream.
      }
    });

    await page.goto("/playground?devtools=on");
    await waitForNavIdle(page);
    await page.getByRole("button", { name: "Next" }).click();
    await waitForNavIdle(page);
    await page.waitForTimeout(250);

    const report = (await page.evaluate(() =>
      (window as unknown as { flemo: { report: () => unknown } }).flemo.report()
    )) as FlemoReport;

    expect(
      report.overrides.warnings.some((entry) => entry.includes("flemo:motion-driver-force"))
    ).toBe(true);
    // The malformed pin never routed anything: desktop stays compiled.
    const push = report.flights.find((flight) => flight.kind === "PUSH");
    expect(push?.driver).toBe("compiled");
  });
});
