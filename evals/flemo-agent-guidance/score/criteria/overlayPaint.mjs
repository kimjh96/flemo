// OVERLAY PAINT (15 points, critical)
//
// "An overlay opened from contained content paints above outer shared chrome
// without changing either navigation stack."
//
// The trap this criterion is built around: a scope's own content cannot outrank
// a flight or the chrome above it, so an overlay written as a positioned div
// inside the panel is painted UNDER the app header no matter what z-index it
// carries. The only way to see that is to ask the page what is actually on top
// at the header's own coordinates, which is what a hit test is. Reading the
// overlay's computed z-index instead would call the broken version correct.
//
// The second half is a navigation question: a dialog is not a screen. Opening
// it must leave every Router's stack exactly where it was, including the panel
// the control was pressed in.

import { act, role, settled, signature, stacks } from "../drive.mjs";
import { resolve } from "../contract.mjs";

export const id = "overlay-paint";

export const run = async ({ page, map }) => {
  await settled(page);
  const failures = [];
  const before = await stacks(page);

  await act(page, map, "open-overlay");
  const overlay = role(page, map, "overlay").first();
  if ((await overlay.count()) === 0) {
    return { pass: false, failures: ["the overlay never opened"], detail: null };
  }

  // WHAT IS ON TOP OF THE HEADER. Sampled across the header's own box rather
  // than at one point, because an overlay can cover the middle of a bar and
  // leave its leading control exposed, which is the half-covered result a
  // reviewer reports as the dialog sliding under the chrome.
  const covering = await page.evaluate(
    (selectors) => {
      const header = document.querySelector(selectors.header);
      const overlayElement = document.querySelector(selectors.overlay);
      if (!header || !overlayElement) return null;
      const box = header.getBoundingClientRect();
      const points = [];
      for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const x = box.x + box.width * fx;
        const y = box.y + box.height * 0.5;
        const hit = document.elementFromPoint(x, y);
        points.push({
          fx,
          covered: hit !== null && (overlayElement.contains(hit) || hit === overlayElement),
          hit: hit
            ? hit.tagName + (hit.className ? `.${String(hit.className).slice(0, 24)}` : "")
            : null
        });
      }
      return { box: [box.x, box.y, box.width, box.height].map(Math.round), points };
    },
    {
      header: resolve(map, "shared-header").selector,
      overlay: resolve(map, "overlay").selector
    }
  );

  if (covering === null) failures.push("no header or overlay to test");
  else {
    const exposed = covering.points.filter((point) => !point.covered);
    if (exposed.length > 0) {
      failures.push(
        `the overlay leaves the header exposed at ${exposed.map((point) => point.fx).join(", ")} (${exposed[0].hit})`
      );
    }
  }

  const during = await stacks(page);
  for (const scope of new Set([...Object.keys(before.scopes), ...Object.keys(during.scopes)])) {
    if (signature(before, scope) !== signature(during, scope)) {
      failures.push(`opening the overlay moved scope ${scope}`);
    }
  }
  if (during.url !== before.url) failures.push(`opening the overlay changed the address bar`);

  // And it closes, leaving the stacks where they were: an overlay that cannot
  // be dismissed is a navigation the reviewer has to reload out of.
  await act(page, map, "overlay-close");
  const after = await stacks(page);
  if ((await role(page, map, "overlay").count()) > 0) failures.push("the overlay did not close");
  for (const scope of new Set([...Object.keys(before.scopes), ...Object.keys(after.scopes)])) {
    if (signature(before, scope) !== signature(after, scope)) {
      failures.push(`closing the overlay moved scope ${scope}`);
    }
  }

  return { pass: failures.length === 0, failures, detail: covering };
};
