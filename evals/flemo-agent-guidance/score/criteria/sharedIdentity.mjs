// SHARED IDENTITY (15 points, critical)
//
// "The shared object and its repeated title travel as one identity without
// doubled glyphs, blur, or landing residue."
//
// The object is opened the way the prompt describes it: the featured cover, the
// highlighted tile, the featured place card is what the reviewer taps, and it
// has to arrive as the other screen's hero. So the flight this criterion judges
// is the one the object itself starts.
//
// Three separable failures, one probe:
//
//   DOUBLED GLYPHS. A submission that cross-fades two boxes instead of pairing
//   one identity prints the title twice over itself for as long as the fade
//   lasts. Counting PAINTED copies is the assertion class that matters, because
//   each side's own opacity reads healthy while the pair doubles. A morph's own
//   copy is dimmed by the engine for exactly this reason, so a second painted
//   copy is the submission's, not the runtime's.
//
//   BLUR. Type carried under a scale is resampled rather than re-rastered on
//   WebKit, which is the difference between a title that travels and a title
//   that smears. A paired text morph animates its size; a scaled one is the
//   defect.
//
//   RESIDUE. The flight layer is empty at rest. Anything left in it after the
//   landing is a flight that never finished.

import { sampleFlight, settled, target } from "../drive.mjs";

export const id = "shared-identity";

// HOW MUCH OF A GLYPH REACHES THE GLASS.
//
// The product of every opacity above it, and zero as soon as anything above it
// is `visibility: hidden`. Both halves are needed: a hand-over is usually
// written on an ancestor's opacity, and the runtime keeps a MORPH's place in
// its own screen with a stand-in that is hidden rather than transparent. Read
// by opacity alone, that stand-in is a second full-ink copy of the title on
// every frame of every flight, which is a defect the page is not committing.
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
  const wanted = window.__evalTitle ?? "";
  let painted = 0;
  const scaled = [];
  if (wanted) {
    for (const element of document.querySelectorAll("body *")) {
      if (element.children.length > 0) continue;
      if ((element.textContent ?? "").replace(/\s+/g, " ").trim() !== wanted) continue;
      // Only what the flight itself is carrying: an element in a layer, or in a
      // screen that is currently moving. A title resting in some other, idle
      // screen is not this flight's doubling.
      const moving =
        element.closest("[data-flemo-morph-layer], [data-flemo-part-layer]") !== null ||
        ["PUSHING", "POPPING", "REPLACING"].includes(
          element.closest("[data-flemo-screen]")?.getAttribute("data-flemo-status") ?? ""
        );
      if (!moving) continue;
      // A copy nobody can see cannot look soft, and the runtime carries one on
      // purpose: the ghost rides the arrival's box on a transform, so its own
      // dimmed copy of the title is scaled on every correct flight. Softness is
      // therefore only ever asked of what is actually being painted.
      if (ink(element) <= 0.5) continue;
      painted += 1;
      // Scale accumulated between the glyph and whatever is carrying it: the
      // element's own and every one in between, from `transform` and from the
      // standalone `scale` property, which does not appear in the transform.
      // The walk stops at the layer or the screen, because a screen-carrying
      // camera is an authored zoom rather than a title being resampled.
      let sx = 1;
      let sy = 1;
      for (let node = element; node; node = node.parentElement) {
        if (node.hasAttribute("data-flemo-morph-layer") || node.hasAttribute("data-flemo-screen")) {
          break;
        }
        const style = getComputedStyle(node);
        const matrix = new DOMMatrixReadOnly(style.transform);
        sx *= Math.hypot(matrix.a, matrix.b);
        sy *= Math.hypot(matrix.c, matrix.d);
        const own = style.scale;
        if (own && own !== "none") {
          const [ownX, ownY = ownX] = own.split(/\s+/).map(Number);
          if (Number.isFinite(ownX)) sx *= ownX;
          if (Number.isFinite(ownY)) sy *= ownY;
        }
      }
      if (Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02) {
        scaled.push(`${sx.toFixed(2)}x${sy.toFixed(2)}`);
      }
    }
  }
  return {
    painted,
    scaled,
    flying: document.querySelectorAll("[data-flemo-morph-layer] > *").length
  };
};

export const run = async ({ page, map }) => {
  const object = await target(page, map, "shared-object");
  // The repeated title is the text the object carries: a submission marks it
  // `shared-text`, and where the map points elsewhere the object's own text
  // stands in for it.
  const title = await object.evaluate((element) => {
    const inner = element.querySelector('[data-eval="shared-text"], [data-flemo-morph-name]');
    return ((inner ?? element).textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  });
  const paired = await object.evaluate((element) =>
    element.closest("[data-flemo-morph-name]")
      ? element.closest("[data-flemo-morph-name]").getAttribute("data-flemo-morph-name")
      : (element.querySelector("[data-flemo-morph-name]")?.getAttribute("data-flemo-morph-name") ??
        null)
  );

  await page.evaluate((text) => {
    window.__evalTitle = text;
  }, title);

  const samples = await sampleFlight(page, probe, {
    trigger: async () => (await target(page, map, "shared-object")).click()
  });
  await settled(page);

  const failures = [];
  if (paired === null) failures.push("the shared object is not a paired Morph");

  const flew = samples.filter((sample) => (sample.value?.flying ?? 0) > 0);
  if (flew.length === 0) failures.push("the object was never staged in the flight layer");

  const doubled = samples.filter((sample) => (sample.value?.painted ?? 0) > 1);
  if (doubled.length > 0) {
    failures.push(`the title was painted twice on ${doubled.length} of ${samples.length} frames`);
  }

  const soft = samples.flatMap((sample) => sample.value?.scaled ?? []);
  if (soft.length > 0) failures.push(`the title travelled under a scale (${soft[0]})`);

  const residue = samples.at(-1)?.value?.flying ?? 0;
  if (residue > 0) failures.push(`${residue} element(s) left in the flight layer`);

  return {
    pass: failures.length === 0,
    failures,
    detail: { title, paired, frames: samples.length, flightFrames: flew.length }
  };
};
