// SPATIAL PHASE (15 points, critical)
//
// "At equal screen displacement, programmatic pop and swipe place changing
// header fields at the same fraction of their paths."
//
// The one criterion that cannot be judged by looking at either motion alone:
// both a pop and a drag can read perfectly while disagreeing with each other,
// and the reviewer meets that as "the swipe back looks like a different
// transition from the pop it walks". It shows up whenever the fields are driven
// by a clock instead of by the screen — a hand-written gesture handler, a part
// opted out of the default rider, an easing applied twice.
//
// So the comparison is made in SPACE, not in time. The screen's own
// displacement is the shared coordinate: sample the fields against it while the
// pop plays, sample them again while a finger holds the screen at the same
// displacements, and require the same reading at the same place.

import {
  appBox,
  pop,
  releaseSwipe,
  sampleFlight,
  scopeOf,
  settled,
  swipeTo,
  target
} from "../drive.mjs";
import { resolve } from "../contract.mjs";

export const id = "spatial-phase";

// Where the dismissing screen stands, as a fraction of the app's width, and how
// much ink each copy of the changing field carries. The pair is reported sorted
// rather than by side, because which copy is "the arriving one" is the
// submission's business and swaps between a pop and a drag.
const readScript = () => {
  const ink = (node) => {
    let value = 1;
    for (let element = node; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") return 0;
      value *= Number(style.opacity);
    }
    return value;
  };
  const app = window.__evalApp;
  // The app's own top screen. A submission can be hosted inside another flemo
  // app, and that host's screen comes first in the document: measured against
  // it, every displacement below is the wrong screen's.
  const top = document.querySelector(
    `[data-flemo-screen][data-flemo-active="true"][data-flemo-router="${window.__evalScope}"]`
  );
  const rect = top?.getBoundingClientRect();
  const displacement = rect && app.width > 0 ? (rect.x - app.x) / app.width : null;
  const inks = [...document.querySelectorAll(window.__evalTitleSelector)]
    .map((element) => ink(element))
    .sort((a, b) => b - a);
  return { displacement, high: inks[0] ?? null, low: inks[1] ?? null };
};

const nearest = (curve, displacement) =>
  curve
    .filter((point) => Number.isFinite(point.displacement))
    .reduce(
      (best, point) =>
        best === null ||
        Math.abs(point.displacement - displacement) < Math.abs(best.displacement - displacement)
          ? point
          : best,
      null
    );

export const run = async ({ page, map }) => {
  const failures = [];
  await settled(page);
  const box = await appBox(page, map);
  const scope = await scopeOf(page, resolve(map, "app-home").selector);
  await page.evaluate(
    (setup) => {
      window.__evalApp = setup.app;
      window.__evalTitleSelector = setup.title;
      window.__evalScope = setup.scope;
    },
    { app: box, title: resolve(map, "shared-title").selector, scope }
  );

  // THE POP'S OWN CURVE, sampled every frame it is painted on.
  await (await target(page, map, "shared-object")).click();
  await settled(page);
  const samples = await sampleFlight(page, readScript, { trigger: () => pop(page, map) });
  const popCurve = samples
    .map((sample) => sample.value)
    .filter((point) => point && Number.isFinite(point.displacement));
  if (popCurve.length < 4) failures.push("the pop produced no measurable displacement curve");

  // THE DRAG'S OWN READINGS, taken while the finger holds the screen still.
  await (await target(page, map, "shared-object")).click();
  await settled(page);
  const held = [];
  for (const fraction of [0.25, 0.45, 0.65]) {
    await swipeTo(page, map, fraction);
    held.push(
      await page.evaluate((read) => new Function(`return (${read})`)()(), readScript.toString())
    );
    // A cancelled drag leaves the screen where it was, so the next hold starts
    // from the same place without re-opening anything.
    await releaseSwipe(page, map, { home: true, box });
    await settled(page);
  }

  // COMPARISON. At the displacement the finger is holding, the pop's own curve
  // says what the fields should read.
  const gaps = [];
  for (const point of held) {
    if (!Number.isFinite(point.displacement)) {
      failures.push("the drag moved no screen");
      continue;
    }
    const match = nearest(popCurve, point.displacement);
    if (!match) continue;
    const high = Math.abs((point.high ?? 0) - (match.high ?? 0));
    const low = Math.abs((point.low ?? 0) - (match.low ?? 0));
    gaps.push({
      at: Number(point.displacement.toFixed(2)),
      popAt: Number(match.displacement.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2))
    });
    // A fifth of the field's whole path. Anything inside that is the difference
    // between two samplings of the same curve; anything beyond it is a
    // different curve.
    if (high > 0.2 || low > 0.2) {
      failures.push(
        `at ${(point.displacement * 100).toFixed(0)}% across, the drag reads ${high.toFixed(2)}/${low.toFixed(2)} away from the pop`
      );
    }
  }

  await settled(page);
  return { pass: failures.length === 0, failures, detail: { popFrames: popCurve.length, gaps } };
};
