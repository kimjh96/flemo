import { expect, test, type Page } from "@playwright/test";

import { trackConsoleErrors } from "./helpers/flemo";

// ─────────────────────────────────────────────────────────────────────────────
// Motion-perception regression suite.
//
// The unit suites assert LOGIC (state machines, compiled CSS, convergence
// invariants) in jsdom; every incident of the rAF-engine build slipped
// through one layer below — the RENDERED OUTCOME: which driver actually
// moves which layer, what survives a completed transition, the rhythm of a
// replay chain, where a parked screen stacks, what the driver policy decides
// under storm conditions. Each test here codifies one shipped-or-nearly-
// shipped incident class so it can never regress silently again.
// ─────────────────────────────────────────────────────────────────────────────

// Samples flemo screens every animation frame for `duration` ms and reports,
// per participant kind, how many frames showed the rAF player actively
// driving it (inline animation suppression + an advancing inline value).
const sampleTransition = (page: Page, duration: number) =>
  page.evaluate((windowMs) => {
    return new Promise<{
      activeDriven: number;
      passiveDriven: number;
      decoratorDriven: number;
      transitionalFrames: number;
    }>((resolve) => {
      const counts = { activeDriven: 0, passiveDriven: 0, decoratorDriven: 0 };
      let transitionalFrames = 0;
      const lastValue = new Map<Element, string>();
      const start = performance.now();

      const advanced = (element: HTMLElement, value: string) => {
        const moved = lastValue.has(element) && lastValue.get(element) !== value;
        lastValue.set(element, value);
        return moved;
      };

      const loop = () => {
        let sawTransitional = false;
        for (const element of document.querySelectorAll<HTMLElement>("[data-flemo-screen]")) {
          const status = element.getAttribute("data-flemo-status") ?? "";
          if (status !== "PUSHING" && status !== "POPPING" && status !== "REPLACING") continue;
          sawTransitional = true;
          // Player signature: the compiled animation is suppressed inline and
          // the player writes transform/opacity inline every frame.
          const driven =
            element.style.animation !== "" &&
            advanced(element, `${element.style.transform}|${element.style.opacity}`);
          if (!driven) continue;
          if (element.getAttribute("data-flemo-active") === "true") counts.activeDriven += 1;
          else counts.passiveDriven += 1;
        }
        for (const decorator of document.querySelectorAll<HTMLElement>("[data-flemo-decorator]")) {
          if (decorator.style.animation !== "" && advanced(decorator, decorator.style.opacity)) {
            counts.decoratorDriven += 1;
          }
        }
        if (sawTransitional) transitionalFrames += 1;
        if (performance.now() - start < windowMs) requestAnimationFrame(loop);
        else resolve({ ...counts, transitionalFrames });
      };
      requestAnimationFrame(loop);
    });
  }, duration);

const inlineLeftovers = (page: Page) =>
  page.$$eval("[data-flemo-screen]", (screens) =>
    screens
      .map((screen) => (screen as HTMLElement).style.transform || "")
      .filter((transform) => transform !== "")
  );

const openPlaygroundWithCupertino = async (page: Page) => {
  await page.goto("/playground");
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Cupertino" }).first().click();
};

test.describe("motion perception", () => {
  // INCIDENT: a one-sided variant property silently kept the exiting screen
  // on the CSS driver while the entering screen ran on the player — two
  // clocks, visibly disharmonious, and green across every unit suite.
  test("a single navigation drives every participant off the player", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await openPlaygroundWithCupertino(page);

    const sample = sampleTransition(page, 900);
    await page.getByRole("button", { name: "Next" }).click();
    const counts = await sample;

    expect(counts.activeDriven, "entering screen must step on the player").toBeGreaterThan(5);
    expect(counts.passiveDriven, "exiting screen must share the player clock").toBeGreaterThan(5);
    expect(counts.decoratorDriven, "the dim must share the player clock").toBeGreaterThan(5);
    expect(errors).toEqual([]);
  });

  // INCIDENT: the player's inline writes survived on the covered prev screen
  // because its COMPLETED effect never runs (Activity freezes it in the same
  // commit); the parallax offset stayed as a stale baseline.
  test("no inline transform survives completed transitions", async ({ page }) => {
    await openPlaygroundWithCupertino(page);

    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForTimeout(1000);
    expect(await inlineLeftovers(page)).toEqual([]);

    await page.goBack();
    await page.waitForTimeout(1000);
    expect(await inlineLeftovers(page)).toEqual([]);
  });

  // INCIDENT: a leftover experiment value stretched the anim-hold, turning a
  // rapid back chain into [freeze → fade] staccato; and an earlier bug class
  // swallowed queued replays entirely. Assert BOTH: every hop replays, and
  // hops run back-to-back within a dead-time budget.
  test("a rapid back chain replays every hop back-to-back", async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 768, "desktop sidebar only");
    await page.goto("/docs");
    await expect(page.getByRole("heading", { name: "Introduction", level: 1 })).toBeVisible();

    const aside = page.locator("aside");
    for (const menu of ["Router and Route", "Screen", "Transitions"]) {
      await aside.getByRole("button", { name: menu, exact: true }).click();
      await page.waitForTimeout(700);
    }

    const rhythm = page.evaluate(() => {
      return new Promise<{ replays: number; longestDeadMs: number }>((resolve) => {
        let replays = 0;
        let longestDeadMs = 0;
        let deadSince: number | null = null;
        let sawFirstMotion = false;
        let lastActivity = performance.now();
        const marked = new WeakSet<Element>();
        const lastOpacity = new Map<Element, string>();
        const start = performance.now();

        const loop = () => {
          let motion = false;
          for (const element of document.querySelectorAll<HTMLElement>("[data-flemo-screen]")) {
            if (element.getAttribute("data-flemo-status") !== "POPPING") continue;
            if (element.getAttribute("data-flemo-active") === "true" && !marked.has(element)) {
              marked.add(element);
              replays += 1;
            }
            const opacity = getComputedStyle(element).opacity;
            if (lastOpacity.has(element) && lastOpacity.get(element) !== opacity) motion = true;
            lastOpacity.set(element, opacity);
          }
          const now = performance.now();
          if (motion) {
            if (sawFirstMotion && deadSince !== null) {
              longestDeadMs = Math.max(longestDeadMs, now - deadSince);
            }
            sawFirstMotion = true;
            deadSince = null;
            lastActivity = now;
          } else if (sawFirstMotion && deadSince === null) {
            deadSince = now;
          }
          // Stop once quiet for 1.5s after motion began, or after 12s flat.
          const quietFor = now - lastActivity;
          if ((sawFirstMotion && quietFor > 1500) || now - start > 12000) {
            resolve({ replays, longestDeadMs });
            return;
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
    });

    for (let i = 0; i < 3; i++) {
      await page.goBack();
      await page.waitForTimeout(90);
    }
    const { replays, longestDeadMs } = await rhythm;

    expect(replays, "every queued back must replay its transition").toBe(3);
    // Headed measurement lands ~33ms; the budget leaves headroom for CI while
    // still catching the 100ms+ staccato class.
    expect(longestDeadMs, "hops must run back-to-back").toBeLessThan(300);
    await expect(page).toHaveURL(/\/docs(\/introduction)?$/);
  });

  // INCIDENT: park-under's stacking demotion sat on the inner scope while
  // siblings stack by the OUTER container's DOM order — the next screen
  // flashed fullscreen over the current one during every push hold.
  test("a park-under screen stacks beneath its cover for the whole hold", async ({ page }) => {
    await openPlaygroundWithCupertino(page);

    const watch = page.evaluate(() => {
      return new Promise<{ parkUnderFrames: number; leaks: number }>((resolve) => {
        let parkUnderFrames = 0;
        let leaks = 0;
        const start = performance.now();
        const loop = () => {
          for (const element of document.querySelectorAll<HTMLElement>(
            '[data-flemo-anim-hold="park-under"]'
          )) {
            parkUnderFrames += 1;
            // The OUTER screen container must carry the demotion; otherwise
            // DOM order paints the parked screen on top.
            let demoted = false;
            let node: HTMLElement | null = element;
            while (node && node !== document.body) {
              if (getComputedStyle(node).zIndex === "-1") {
                demoted = true;
                break;
              }
              node = node.parentElement;
            }
            if (!demoted) leaks += 1;
          }
          if (performance.now() - start < 800) requestAnimationFrame(loop);
          else resolve({ parkUnderFrames, leaks });
        };
        requestAnimationFrame(loop);
      });
    });
    await page.getByRole("button", { name: "Next" }).click();
    const { parkUnderFrames, leaks } = await watch;

    expect(parkUnderFrames, "the push hold must engage park-under").toBeGreaterThan(0);
    expect(leaks, "a parked screen above its cover is a fullscreen flash").toBe(0);
  });

  // INCIDENT: field diagnosis needed a REAL driver pin (the plain
  // flemo:motion-driver key is probation and self-heals on a clean probe, so
  // an A/B built on it silently kept measuring the player). The force key is
  // the diagnostic tool that isolation now depends on — it must keep working
  // against the shipped build, and it must never be silent while active.
  test("the diagnostic force key pins the compiled-CSS driver", async ({ page }) => {
    await openPlaygroundWithCupertino(page);
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    await page.evaluate(() => localStorage.setItem("flemo:motion-driver-force", "css"));

    const sample = sampleTransition(page, 900);
    await page.getByRole("button", { name: "Next" }).click();
    const counts = await sample;

    expect(counts.activeDriven, "a pinned CSS driver must keep the player off").toBe(0);
    expect(counts.transitionalFrames, "the transition itself must still run").toBeGreaterThan(5);
    expect(
      warnings.some((text) => text.includes("flemo:motion-driver-force")),
      "an active pin must announce itself in the console"
    ).toBe(true);
    await page.evaluate(() => localStorage.removeItem("flemo:motion-driver-force"));
  });

  // INCIDENT: replay chains inherently stall a main-thread player (the next
  // screen's mount commits land mid-flight), and the driver policy read that
  // as a slow device — a persisted, silent demotion that put the user's
  // whole session back on the janky compositor path.
  test("a back/forward storm never demotes the motion driver", async ({ page }) => {
    await openPlaygroundWithCupertino(page);

    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Next" }).click();
      await page.waitForTimeout(750);
    }
    for (let i = 0; i < 3; i++) {
      await page.goBack();
      await page.waitForTimeout(70);
    }
    await page.waitForTimeout(3500);

    expect(await page.evaluate(() => localStorage.getItem("flemo:motion-driver"))).toBeNull();

    // And the next single navigation still runs on the player.
    const sample = sampleTransition(page, 900);
    await page.getByRole("button", { name: "Next" }).click();
    const counts = await sample;
    expect(counts.activeDriven, "post-storm single navigation must use the player").toBeGreaterThan(
      5
    );
  });
});
