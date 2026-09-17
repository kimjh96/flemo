// CLEANUP (10 points, critical)
//
// "No console errors, stuck navigation, duplicate active participants, or
// transition artifacts remain after landing."
//
// Every one of these is a state the page is left in, so all four are read after
// the run's last flight has settled. The flight layers are the tell: the engine
// stages a copy, a stand-in and a ghost while an element travels and takes them
// all away on landing, so anything still in a layer is a flight that never
// finished cleaning up after itself.

import { MOVING, settled } from "../drive.mjs";

export const id = "cleanup";

// Reads the state a run is left in, so it needs nothing exposed up front.
export const needs = [];

export const run = async ({ page, errors }) => {
  await settled(page);
  const state = await page.evaluate((moving) => {
    const scopes = {};
    for (const screen of document.querySelectorAll("[data-flemo-screen]")) {
      const owner = screen.getAttribute("data-flemo-router") ?? "(none)";
      const entry = (scopes[owner] ??= { tops: 0, stuck: 0 });
      if (screen.getAttribute("data-flemo-active") === "true") entry.tops += 1;
      if (moving.includes(screen.getAttribute("data-flemo-status") ?? "")) entry.stuck += 1;
    }
    const count = (selector) => document.querySelectorAll(selector).length;
    return {
      scopes,
      residue: {
        morphLayer: [...document.querySelectorAll("[data-flemo-morph-layer]")].reduce(
          (total, layer) => total + layer.children.length,
          0
        ),
        partLayer: [...document.querySelectorAll("[data-flemo-part-layer]")].reduce(
          (total, layer) => total + layer.children.length,
          0
        ),
        ghosts: count("[data-flemo-morph-ghost]"),
        standIns: count("[data-flemo-morph-stand-in], [data-flemo-part-stand-in]"),
        held: count('[data-flemo-anim-hold="true"]')
      }
    };
  }, MOVING);

  const failures = [];
  if (errors.length > 0) failures.push(`console: ${errors.slice(0, 3).join(" | ")}`);
  for (const [scope, entry] of Object.entries(state.scopes)) {
    if (entry.stuck > 0) failures.push(`scope ${scope} left ${entry.stuck} screen(s) mid-flight`);
    // A scope states exactly one stack top. Zero means the binding lost it;
    // more than one means two screens each believe they are the top, which is
    // the shape a doubled push leaves behind.
    if (entry.tops !== 1) failures.push(`scope ${scope} has ${entry.tops} active screens`);
  }
  for (const [what, n] of Object.entries(state.residue)) {
    if (n > 0) failures.push(`${what} still holds ${n}`);
  }

  return { pass: failures.length === 0, failures, detail: state };
};
