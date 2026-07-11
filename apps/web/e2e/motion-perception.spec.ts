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
  test("a single navigation drives every participant off the player", async ({
    page,
    browserName
  }) => {
    test.skip(browserName === "webkit", "WebKit defaults to the compositor driver");
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

  // INCIDENT: motion the numeric player could not parse (mismatched value
  // templates — clip-path across shorthand forms, calc(), mixed units)
  // silently stayed on the compositor-clocked CSS path, reintroducing the
  // judder class for exactly the custom transitions users author themselves.
  // The scrubbed-WAAPI tier must drive them on the player's clock.
  test("a template-mismatched custom transition is scrubbed on the player clock", async ({
    page,
    browserName
  }) => {
    test.skip(browserName === "webkit", "WebKit defaults to the compositor driver");
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Wipe" }).first().click();

    const sample = page.evaluate(() => {
      return new Promise<{ suppressedFrames: number; clipValues: number }>((resolve) => {
        const seen = new Set<string>();
        let suppressedFrames = 0;
        const start = performance.now();
        const loop = () => {
          for (const element of document.querySelectorAll<HTMLElement>("[data-flemo-screen]")) {
            if (element.getAttribute("data-flemo-status") !== "PUSHING") continue;
            if (element.getAttribute("data-flemo-active") !== "true") continue;
            // Scrub signature: the compiled animation is suppressed (the
            // player owns the motion) while the COMPUTED clip-path advances
            // frame over frame via the browser's own interpolation.
            if (element.style.animation !== "") suppressedFrames += 1;
            seen.add(getComputedStyle(element).clipPath);
          }
          if (performance.now() - start < 900) requestAnimationFrame(loop);
          else resolve({ suppressedFrames, clipValues: seen.size });
        };
        requestAnimationFrame(loop);
      });
    });
    await page.getByRole("button", { name: "Next" }).click();
    const { suppressedFrames, clipValues } = await sample;

    expect(
      suppressedFrames,
      "the player must own the motion (animation suppressed)"
    ).toBeGreaterThan(5);
    expect(
      clipValues,
      "the clip must advance per frame (browser-interpolated scrub)"
    ).toBeGreaterThan(8);
    // The scrub's fill must not outlive the transition: at rest the computed
    // clip-path is the compiled rest rule's, not a stuck animation value.
    await page.waitForTimeout(800);
    expect(await inlineLeftovers(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  // INCIDENT: <Part> elements ran their compiled CSS animations on the
  // compositor clock while their screen ran on the player — the mixed-clock
  // class, per part. Parts must join the shared player.
  test("a <Part> rides the player clock with its screen", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit defaults to the compositor driver");
    await openPlaygroundWithCupertino(page);

    const sample = page.evaluate(() => {
      return new Promise<{ suppressedFrames: number; opacityValues: number }>((resolve) => {
        const seen = new Set<string>();
        let suppressedFrames = 0;
        const start = performance.now();
        const loop = () => {
          for (const part of document.querySelectorAll<HTMLElement>(
            '[data-flemo-part-name="panel-title"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
          )) {
            if (part.style.animation !== "") suppressedFrames += 1;
            seen.add(getComputedStyle(part).opacity);
          }
          if (performance.now() - start < 900) requestAnimationFrame(loop);
          else resolve({ suppressedFrames, opacityValues: seen.size });
        };
        requestAnimationFrame(loop);
      });
    });
    await page.getByRole("button", { name: "Next" }).click();
    const { suppressedFrames, opacityValues } = await sample;

    expect(suppressedFrames, "the part's compiled animation must be suppressed").toBeGreaterThan(5);
    expect(opacityValues, "the part must advance on the player clock").toBeGreaterThan(4);
    await page.waitForTimeout(800);
    expect(
      await page.$$eval("[data-flemo-part-name]", (parts) =>
        parts.map((part) => (part as HTMLElement).style.transform || "").filter((t) => t !== "")
      ),
      "no inline part writes may survive completion"
    ).toEqual([]);
  });

  // INCIDENT: the release settle (the motion after a swipe lets go) ran as an
  // inline CSS transition — compositor-clocked, the last flemo-driven motion
  // outside the player. It must scrub on the settle clock.
  test("a swipe release settles on the scrubbed clock, not a CSS transition", async ({
    page,
    browserName
  }) => {
    test.skip(browserName === "webkit", "WebKit defaults to the compositor driver");
    await openPlaygroundWithCupertino(page);
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForTimeout(900); // land on a non-root, swipeable screen

    const result = await page.evaluate(async () => {
      // The innermost (lab) screen: nested routers mean several active
      // screens exist; the swipeable one carries the cupertino transition.
      const scope = document.querySelector<HTMLElement>(
        '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-active="true"]'
      )!;
      const pointer = (type: string, x: number) =>
        scope.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            clientX: x,
            clientY: 300,
            bubbles: true
          })
        );

      // Drag 40px (below the 50px trigger) and release: the screen settles
      // back to rest.
      pointer("pointerdown", 8);
      for (let x = 12; x <= 48; x += 6) {
        pointer("pointermove", x);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      pointer("pointerup", 48);

      // Sample the settle window.
      const transforms = new Set<string>();
      let cssTransitionFrames = 0;
      let scrubAnimationFrames = 0;
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const loop = () => {
          transforms.add(getComputedStyle(scope).transform);
          if (scope.style.transition !== "" && scope.style.transition !== "none") {
            cssTransitionFrames += 1;
          }
          if (scope.getAnimations().length > 0) scrubAnimationFrames += 1;
          if (performance.now() - start < 400) requestAnimationFrame(loop);
          else resolve();
        };
        requestAnimationFrame(loop);
      });
      return { transforms: transforms.size, cssTransitionFrames, scrubAnimationFrames };
    });

    expect(result.transforms, "the settle must move across frames").toBeGreaterThan(4);
    expect(result.cssTransitionFrames, "no inline CSS transition may drive the settle").toBe(0);
    expect(
      result.scrubAnimationFrames,
      "the scrub animation must drive the settle"
    ).toBeGreaterThan(3);
  });

  // The compositor defect the player routes around is Blink-specific: on
  // WebKit the compiled CSS driver must stay the default (eye-confirmed: the
  // main-thread player starves Safari, worst on iOS, while WebKit's
  // compositor is healthy).
  test("WebKit defaults to the compositor driver", async ({ page, browserName }) => {
    test.skip(browserName !== "webkit", "engine-default assertion for WebKit");
    const { errors } = trackConsoleErrors(page);
    await openPlaygroundWithCupertino(page);

    const sample = page.evaluate(() => {
      return new Promise<{ transitional: number; suppressed: number }>((resolve) => {
        let transitional = 0;
        let suppressed = 0;
        const start = performance.now();
        const loop = () => {
          for (const element of document.querySelectorAll<HTMLElement>("[data-flemo-screen]")) {
            if (element.getAttribute("data-flemo-status") !== "PUSHING") continue;
            transitional += 1;
            if (element.style.animation !== "") suppressed += 1;
          }
          if (performance.now() - start < 900) requestAnimationFrame(loop);
          else resolve({ transitional, suppressed });
        };
        requestAnimationFrame(loop);
      });
    });
    await page.getByRole("button", { name: "Next" }).click();
    const { transitional, suppressed } = await sample;

    expect(transitional, "the transition must run").toBeGreaterThan(5);
    expect(suppressed, "the compiled animation must stay in charge").toBe(0);
    expect(errors).toEqual([]);
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
  test("a back/forward storm never demotes the motion driver", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit defaults to the compositor driver");
    await openPlaygroundWithCupertino(page);

    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Next" }).click();
      await page.waitForTimeout(750);
    }

    // Health gate: the property under test is "a replay chain must not strike
    // a HEALTHY device". A runner whose main thread stalls even these
    // leisurely single navigations earns strikes LEGITIMATELY (that is the
    // policy working) — on such a machine the property is untestable, so skip
    // instead of reading a correct demotion as a regression. The player's own
    // frame-gap diagnostic is the judge.
    const singleNavLongGaps = await page.evaluate(
      () =>
        ((window as unknown as { __flemoPlayerGaps?: number[] }).__flemoPlayerGaps ?? []).filter(
          (gap) => gap >= 30
        ).length
    );
    test.skip(singleNavLongGaps >= 2, "runner too slow to host the storm-demotion property");

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
