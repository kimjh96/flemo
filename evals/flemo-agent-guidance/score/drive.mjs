// READING A RUNNING FLEMO APP FROM THE OUTSIDE.
//
// The engine publishes its whole state on the DOM: which screens exist, which
// Router owns each one, what status it is in, which side is the stack's top,
// and what is currently staged in the flight layers. `@flemo/devtools` is built
// on exactly these surfaces, and so is this scorer. Nothing here imports the
// library, reads a submission's source, or depends on a build's internals: a
// criterion that cannot be seen from the page is not a criterion this
// evaluation can register.

import { resolve } from "./contract.mjs";

/** Statuses that mean a flight is still in the air. */
export const MOVING = ["PUSHING", "POPPING", "REPLACING"];

/** Network noise that is not a submission defect (see the repository's e2e helpers). */
const NETWORK_NOISE = /^Failed to load resource: the server responded with a status/;

/**
 * Collect console errors and uncaught exceptions for the whole session.
 *
 * Started before the first navigation, because an error thrown while the app
 * mounts is exactly the kind a later probe would never see.
 */
export const watchErrors = (page) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (NETWORK_NOISE.test(text)) return;
    errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

/** Wait until no screen is mid-flight, then let the landing commit. */
export const settled = async (page) => {
  await page.waitForFunction((moving) => {
    for (const screen of document.querySelectorAll("[data-flemo-screen]")) {
      if (moving.includes(screen.getAttribute("data-flemo-status") ?? "")) return false;
    }
    return true;
  }, MOVING);
  await page.waitForTimeout(150);
};

// THE STACKS, AS THE PAGE STATES THEM.
//
// `data-flemo-router` is the owning Router's identity, and it is an opaque
// value: a binding mints it per Router instance, so it cannot be matched to a
// name a submission chose. That is enough for this evaluation, which never
// needs to know WHICH Router moved, only whether the one that owns a given
// element moved while the other did not. Scopes are therefore keyed by that
// opaque id and compared to themselves across an action.
const stacksScript = () => {
  const scopes = {};
  for (const screen of document.querySelectorAll("[data-flemo-screen]")) {
    const id = screen.getAttribute("data-flemo-router") ?? "(none)";
    const entry = (scopes[id] ??= { screens: [], top: null });
    entry.screens.push({
      status: screen.getAttribute("data-flemo-status"),
      active: screen.getAttribute("data-flemo-active"),
      transition: screen.getAttribute("data-flemo-transition"),
      text: (screen.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120)
    });
    if (screen.getAttribute("data-flemo-active") === "true") {
      entry.top = (screen.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    }
  }
  return { scopes, url: location.pathname + location.search + location.hash };
};

export const stacks = (page) => page.evaluate(stacksScript);

/**
 * Which scope owns an element, so an action can be attributed to one Router.
 *
 * The element's own `data-flemo-router` when it has one, else the nearest
 * ancestor screen's: a screen carries its owner, and everything a submission
 * renders inside it belongs to that owner.
 */
export const scopeOf = (page, selector) =>
  page.evaluate((one) => {
    const element = document.querySelector(one);
    if (!element) return null;
    const screen = element.closest("[data-flemo-screen]");
    return screen?.getAttribute("data-flemo-router") ?? null;
  }, selector);

/** A settled scope's top screen, as the signature an action is compared against. */
export const signature = (state, scope) => {
  const entry = state.scopes[scope];
  if (!entry) return null;
  return `${entry.screens.length}|${entry.top}`;
};

// THE VISIBLE ONE IS THE REAL ONE.
//
// A role can legitimately match more than one node while the engine is mid-
// flight or just after it: a shared bar's part is staged into the part layer
// and leaves a hidden stand-in behind in its own screen, and a morph leaves one
// too. Both carry the submission's own attributes, because they are copies of
// its markup. Taking the first node in document order therefore picks a
// placeholder as often as not, so a role always resolves to the first node the
// page is actually painting.
// Visibility alone does not separate them: a part that has already handed over
// keeps its box and its markup and simply stops painting, so both copies are
// "visible" and only their effective opacity tells them apart. The role is the
// painted one; where a role wraps a control, the control is what gets clicked,
// because the sibling copy's own subtree sits over the wrapper's centre.
export const role = (page, map, name) => {
  const { selector, text } = resolve(map, name);
  const base = page.locator(selector);
  const named = text ? base.filter({ hasText: text }) : base;
  return named.filter({ visible: true });
};

const paintedIndex = async (locator, text) =>
  locator.evaluateAll((nodes, wanted) => {
    // Opacity down the whole chain, and nothing at all under a hidden
    // ancestor: the runtime keeps a travelling element's place with a stand-in
    // that is hidden rather than transparent, and a role must never resolve to
    // one (see sharedIdentity's probe for the same rule).
    const ink = (node) => {
      let value = 1;
      for (let element = node; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none") return 0;
        value *= Number(style.opacity);
      }
      return value;
    };
    let best = -1;
    let bestInk = -1;
    nodes.forEach((node, index) => {
      if (wanted && !(node.textContent ?? "").includes(wanted)) return;
      const painted = ink(node);
      if (painted > bestInk) {
        bestInk = painted;
        best = index;
      }
    });
    return best;
  }, text);

/** The painted element for a role, and the control inside it where there is one. */
export const target = async (page, map, name) => {
  const { text } = resolve(map, name);
  const all = role(page, map, name);
  const index = await paintedIndex(all, null);
  const element = all.nth(index < 0 ? 0 : index);
  const control = element.locator("button, a, [role=button]").filter({ visible: true });
  return (await control.count()) > 0 ? control.first() : element;
};

/** Click a role and wait out whatever it started. */
export const act = async (page, map, name) => {
  await (await target(page, map, name)).click();
  await settled(page);
};

// POPPING IS THE LEADING CONTROL'S JOB, NOT THE BROWSER'S.
//
// The contract names no back control, because every prompt already has one:
// the header's leading control is the field that "changes naturally on push,
// pop and edge-swipe back", and on the detail screen that is the way back. The
// browser's own back button is not a substitute — a panel with memory history
// does not answer to it, and on a submission served under a path prefix it
// unloads the page instead of popping a stack.
export const pop = async (page, map) => act(page, map, "shared-action");

// SAMPLING A FLIGHT.
//
// Every criterion that judges motion needs the same thing: a probe read once
// per frame from the moment an action is taken until the flight lands. The
// probe runs in the page and returns plain data; the samples come back with
// their own timestamps so a criterion can speak in fractions of the flight
// rather than in frames, which differ between a 60Hz and a 120Hz reviewer.
export const sampleFlight = async (page, probe, { trigger, timeout = 2500 }) => {
  await page.evaluate((source) => {
    const read = new Function(`return (${source})`)();
    window.__evalSamples = [];
    window.__evalArmed = true;
    const t0 = performance.now();
    const tick = () => {
      try {
        window.__evalSamples.push({ t: performance.now() - t0, value: read() });
      } catch (error) {
        window.__evalSamples.push({ t: performance.now() - t0, error: String(error) });
      }
      if (window.__evalArmed) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, probe.toString());
  await trigger();
  await page.waitForFunction(
    (moving) => {
      for (const screen of document.querySelectorAll("[data-flemo-screen]")) {
        if (moving.includes(screen.getAttribute("data-flemo-status") ?? "")) return false;
      }
      return true;
    },
    MOVING,
    { timeout }
  );
  await page.waitForTimeout(100);
  return page.evaluate(() => {
    window.__evalArmed = false;
    return window.__evalSamples;
  });
};

// A SWIPE STARTS AT THE APP'S EDGE, NOT THE WINDOW'S.
//
// The gesture is armed from the leading edge of the region the app occupies. A
// submission usually fills the window, so the two are the same; an app shown
// inside a frame is not, and a drag begun outside it is a drag the engine never
// sees at all. Reading the edge from the app's own top screen makes the same
// gesture work for both, and makes a "nothing happened" result mean the
// submission ignored the gesture rather than that the harness missed the app.
// The app is the scope that owns the home screen, not the biggest thing on the
// page: a submission can be hosted inside a page that is itself a flemo app,
// and the outermost screen is then the host's, not the one a back gesture is
// aimed at.
export const appBox = async (page, map) => {
  const box = await page.evaluate((home) => {
    const anchor = document.querySelector(home);
    const owner = anchor?.closest("[data-flemo-screen]")?.getAttribute("data-flemo-router") ?? null;
    const candidates = [
      ...document.querySelectorAll('[data-flemo-screen][data-flemo-active="true"]')
    ].filter((screen) => owner === null || screen.getAttribute("data-flemo-router") === owner);
    const rect = candidates
      .map((screen) => screen.getBoundingClientRect())
      .filter((one) => one.width > 0 && one.height > 0)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
  }, resolve(map, "app-home").selector);
  if (box) return box;
  const size = page.viewportSize();
  return { x: 0, y: 0, width: size.width, height: size.height };
};

const edge = (box) => ({ x: Math.round(box.x) + 3, y: Math.round(box.y + box.height * 0.5) });

/**
 * Drag from the app's leading edge with a real pointer.
 *
 * `fraction` is how far across the app the finger travels; `release` decides
 * whether the gesture commits or comes home. The pointer is interpolated rather
 * than jumped, because a swipe the engine can read is a stream of moves.
 */
export const swipe = async (page, map, { fraction = 0.6, release = "commit", steps = 16 } = {}) => {
  const box = await appBox(page, map);
  const { x, y } = edge(box);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + Math.round(box.width * fraction), y, { steps });
  if (release === "cancel") await page.mouse.move(x, y, { steps });
  await page.waitForTimeout(50);
  await page.mouse.up();
  await settled(page);
};

/** Hold a drag partway across without releasing it, for a phase comparison. */
export const swipeTo = async (page, map, fraction, steps = 12) => {
  const box = await appBox(page, map);
  const { x, y } = edge(box);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + Math.round(box.width * fraction), y, { steps });
  await page.waitForTimeout(50);
  return box;
};

/** Let a held drag go, either back at the edge (cancel) or where it stands. */
export const releaseSwipe = async (page, map, { home = true, box = null } = {}) => {
  if (home) {
    const rect = box ?? (await appBox(page, map));
    const { x, y } = edge(rect);
    await page.mouse.move(x, y, { steps: 10 });
    await page.waitForTimeout(50);
  }
  await page.mouse.up();
  await settled(page);
};
