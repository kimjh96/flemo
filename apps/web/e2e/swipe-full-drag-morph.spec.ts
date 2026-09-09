import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// A DRAG THAT REACHES THE END IS NOT A FLIGHT THAT FINISHED.
//
// The gesture drives a morph by seeking its compiled animations by hand, and
// `animationend` is dispatched on the PHASE change rather than on the playback:
// an animation seeked to `delay + duration` has left its active phase, so the
// browser fires the event even though it is paused and has never run. It
// arrives with the full duration as `elapsedTime`, which is exactly what a real
// landing reports, and a morph LANDS on that event.
//
// So a swipe carried the whole way across used to put the shared element back
// in its screen mid-gesture, and all three of what that looks like were
// reported from the playground at once:
//
//   1. the element blinked home under a finger that was still down,
//   2. a finger coming back the other way found nothing left to move,
//   3. and the release, with the flight already gone from the scope and
//      therefore never marked delivered, let the navigation stage the whole
//      trip a second time.
//
// None of this is visible to jsdom, which dispatches no animation events for a
// seek. It is measurable here, and only here.
const STAGE = "a, button, [role=tab]";

/** Open a bench case by the name on its control and push the detail screen. */
const enterCase = async (page: import("@playwright/test").Page, name: string) => {
  await page.goto("/en/playground");
  await waitForNavIdle(page);
  await page.evaluate(
    ({ selector, label }) => {
      const control = [...document.querySelectorAll(selector)].find(
        (element) => (element.textContent ?? "").trim() === label
      );
      (control as HTMLElement | undefined)?.click();
    },
    { selector: STAGE, label: name }
  );
  await page.waitForTimeout(500);
  await page.evaluate((selector) => {
    const card = [...document.querySelectorAll(selector)].find((element) =>
      /Aria Wave/.test(element.textContent ?? "")
    );
    (card as HTMLElement | undefined)?.click();
  }, STAGE);
  await waitForNavIdle(page);

  return page.evaluate(() => {
    const active = [...document.querySelectorAll("[data-flemo-screen][data-flemo-router]")].find(
      (element) =>
        element.getAttribute("data-flemo-active") === "true" &&
        element.getAttribute("data-flemo-screen") !== "root"
    );
    if (!active) return null;
    const rect = active.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
};

/** Record every morph animation event, tagged with the phase it arrived in. */
const watchMorphEvents = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const events: { kind: string; name: string; phase: string }[] = [];
    (window as unknown as { __morph: typeof events }).__morph = events;
    (window as unknown as { __phase: string }).__phase = "drag";
    const record = (kind: string) => (event: Event) => {
      const name = (event as AnimationEvent).animationName;
      if (!name?.startsWith("flemo-morph-")) return;
      events.push({
        kind,
        name,
        phase: (window as unknown as { __phase: string }).__phase
      });
    };
    document.addEventListener("animationstart", record("start"), true);
    document.addEventListener("animationend", record("end"), true);
  });

const morphEvents = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __morph: { kind: string; name: string; phase: string }[] }).__morph
  );

/**
 * What the flight layer is carrying, and how big each element of it reads.
 *
 * `spread` sums the box AND the type size because the two kinds of morph on
 * this page grow differently: the artwork re-sizes its box, and the title keeps
 * a box the width of its line slot and re-typesets inside it. One number that
 * both move is what a direction assertion can be written against.
 */
const inFlight = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-flemo-morph-layer] [data-flemo-morph-id]")].map(
      (element) => {
        const rect = element.getBoundingClientRect();
        return {
          id: element.getAttribute("data-flemo-morph-id") ?? "",
          spread:
            rect.width + rect.height + Number.parseFloat(getComputedStyle(element).fontSize || "0")
        };
      }
    )
  );

/**
 * Carry the drag the whole way across and PAST the far edge.
 *
 * The controller clamps its own progress at 1, so a finger that runs out of
 * screen reports exactly the end — which is the case every phone produces and
 * the one that used to land the flight.
 */
const dragPastTheEnd = async (
  page: import("@playwright/test").Page,
  box: { x: number; y: number; width: number; height: number }
) => {
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 3, y);
  await page.mouse.down();
  for (const fraction of [0.1, 0.35, 0.6, 0.85]) {
    await page.mouse.move(box.x + box.width * fraction, y, { steps: 6 });
    await page.waitForTimeout(40);
  }
  await page.mouse.move(box.x + box.width + 40, y, { steps: 6 });
  await page.waitForTimeout(200);
};

test.describe("a swipe carried the whole way across", () => {
  test("keeps the flight in the air while the finger is still down", async ({ page }) => {
    const box = await enterCase(page, "cupertino");
    test.skip(box === null, "no pushed screen on this bench");
    await watchMorphEvents(page);
    await dragPastTheEnd(page, box!);

    // Still in the layer, at the arrival's own metrics: the drag has taken the
    // element the whole way, and taking it there is not the same as landing it.
    const carried = await inFlight(page);
    expect(carried.length).toBeGreaterThan(0);

    // And nothing has reported a landing. The travel is the flight's own clock;
    // the short channels alongside it (a cut, a ghost's crossfade) end on their
    // own and always did.
    const events = await morphEvents(page);
    const landed = events.filter((event) => event.kind === "end" && /i-travel$/.test(event.name));
    expect(landed).toEqual([]);

    await page.mouse.up();
  });

  test("brings the shared element back when the finger comes back", async ({ page }) => {
    const box = await enterCase(page, "cupertino");
    test.skip(box === null, "no pushed screen on this bench");
    await watchMorphEvents(page);
    await dragPastTheEnd(page, box!);

    const atTheEnd = await inFlight(page);
    expect(atTheEnd.length).toBeGreaterThan(0);

    const y = box!.y + box!.height / 2;
    for (const fraction of [0.7, 0.5, 0.3, 0.2]) {
      await page.mouse.move(box!.x + box!.width * fraction, y, { steps: 6 });
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(120);

    // The same elements, and every one of them back off the pose the drag had
    // carried it to: a pop shrinks the shared element into its row, so a finger
    // coming back grows it again.
    const backAgain = await inFlight(page);
    expect(backAgain.map((entry) => entry.id)).toEqual(atTheEnd.map((entry) => entry.id));
    for (const [index, entry] of backAgain.entries()) {
      expect(entry.spread).toBeGreaterThan(atTheEnd[index]!.spread + 1);
    }

    await page.mouse.up();
  });

  test("flies the shared element once, not twice", async ({ page }) => {
    const box = await enterCase(page, "cupertino");
    test.skip(box === null, "no pushed screen on this bench");
    await watchMorphEvents(page);
    await dragPastTheEnd(page, box!);

    await page.evaluate(() => {
      (window as unknown as { __phase: string }).__phase = "release";
    });
    await page.mouse.up();
    await waitForNavIdle(page);
    await page.waitForTimeout(600);

    const events = await morphEvents(page);
    // The gesture staged the flight and the release plays it out. A travel that
    // STARTS after the finger is gone is the navigation staging the same
    // element a second time, from its rest pose, for the whole trip.
    const restaged = events.filter(
      (event) => event.kind === "start" && event.phase === "release" && /travel$/.test(event.name)
    );
    expect(restaged).toEqual([]);

    // And it did land: the layer is empty and the element is back in its tree.
    expect(await inFlight(page)).toEqual([]);
  });
});
