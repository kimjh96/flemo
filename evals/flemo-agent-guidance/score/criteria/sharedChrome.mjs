// SHARED CHROME (15 points, critical)
//
// "The header shell keeps stable geometry while its changing fields hand over
// on push, pop, swipe cancel, and swipe commit."
//
// Two assertions that have to hold at the same time, which is what makes shared
// chrome hard: the SHELL must not move, and the FIELDS must. A submission that
// re-renders the whole header per screen passes the second and fails the first
// (the bar slides or resizes with the screen); one that hoists the header out
// of the screens entirely passes the first and fails the second (the title is
// simply replaced, with nothing handing over). Both are read from the same
// frames, across all four ways a screen can change.

import {
  pop,
  releaseSwipe,
  role,
  sampleFlight,
  settled,
  swipe,
  swipeTo,
  target
} from "../drive.mjs";
import { resolve } from "../contract.mjs";

export const id = "shared-chrome";

const probe = () => {
  const ink = (node) => {
    let value = 1;
    for (let element = node; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") return 0;
      value *= Number(style.opacity);
    }
    return value;
  };
  const seen = (selector) =>
    [...document.querySelectorAll(selector)]
      .map((element) => ({ ink: ink(element), text: (element.textContent ?? "").trim() }))
      .filter((entry) => entry.ink > 0.01);
  const shell = document.querySelector(window.__evalHeader);
  const box = shell?.getBoundingClientRect();
  return {
    shell: box ? [box.x, box.y, box.width, box.height].map((n) => Math.round(n * 10) / 10) : null,
    title: seen(window.__evalTitleSelector),
    action: seen(window.__evalActionSelector)
  };
};

const spread = (samples, index) => {
  const values = samples.map((sample) => sample.value?.shell?.[index]).filter(Number.isFinite);
  return values.length === 0 ? null : Math.max(...values) - Math.min(...values);
};

// A field handed over if its ink moved across the flight: something faded out,
// or in, or both. A field that sat at one value did not participate.
const handedOver = (samples, field) => {
  const inks = samples.flatMap((sample) => (sample.value?.[field] ?? []).map((entry) => entry.ink));
  if (inks.length === 0) return false;
  return Math.max(...inks) - Math.min(...inks) > 0.25;
};

export const run = async ({ page, map }) => {
  await settled(page);
  await page.evaluate(
    (selectors) => {
      window.__evalHeader = selectors.header;
      window.__evalTitleSelector = selectors.title;
      window.__evalActionSelector = selectors.action;
    },
    {
      header: resolve(map, "shared-header").selector,
      title: resolve(map, "shared-title").selector,
      action: resolve(map, "shared-action").selector
    }
  );

  const failures = [];
  const report = {};

  const judge = async (label, samples) => {
    report[label] = { frames: samples.length };
    // The shell is one element for the whole app, so its box is the same on
    // every frame of every flight. A pixel of tolerance covers subpixel layout.
    for (const [index, axis] of ["x", "y", "width", "height"].entries()) {
      const moved = spread(samples, index);
      report[label][axis] = moved;
      if (moved !== null && moved > 1) {
        failures.push(`${label}: the header shell's ${axis} moved by ${moved.toFixed(1)}px`);
      }
    }
    if (samples.every((sample) => sample.value?.shell === null)) {
      failures.push(`${label}: no header shell was found`);
      return;
    }
    if (!handedOver(samples, "title")) failures.push(`${label}: the title did not hand over`);
  };

  await judge(
    "push",
    await sampleFlight(page, probe, {
      trigger: async () => (await target(page, map, "shared-object")).click()
    })
  );
  await judge("pop", await sampleFlight(page, probe, { trigger: () => pop(page, map) }));

  // A cancelled drag is a flight that goes out and comes home, so the shell is
  // held to the same rule while the finger is down and after it lifts.
  await (await target(page, map, "shared-object")).click();
  await settled(page);
  const cancel = await sampleFlight(page, probe, {
    trigger: async () => {
      const box = await swipeTo(page, map, 0.35);
      await releaseSwipe(page, map, { home: true, box });
    }
  });
  report.cancel = { frames: cancel.length };
  for (const [index, axis] of ["x", "y", "width", "height"].entries()) {
    const moved = spread(cancel, index);
    if (moved !== null && moved > 1) {
      failures.push(`swipe cancel: the header shell's ${axis} moved by ${moved.toFixed(1)}px`);
    }
  }
  const stillOnDetail = await page.locator(resolve(map, "app-detail").selector).first().isVisible();
  if (!stillOnDetail) failures.push("swipe cancel: the cancelled gesture left the screen anyway");

  const commit = await sampleFlight(page, probe, {
    trigger: () => swipe(page, map, { fraction: 0.85, release: "commit" })
  });
  await judge("swipe commit", commit);
  const home = await role(page, map, "app-home").count();
  if (home === 0) failures.push("swipe commit: the gesture did not return to the app home");

  await settled(page);
  return { pass: failures.length === 0, failures, detail: report };
};
