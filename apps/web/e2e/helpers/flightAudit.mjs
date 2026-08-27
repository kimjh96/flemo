// A frame-accurate audit of what every participant in a flight is doing.
//
// The previous round of playground work was verified with typecheck, lint,
// build, a green e2e suite, and ONE measurement (bar duration == screen
// duration) taken on one case. All of it passed while the app was visibly
// broken on a device: a header that popped in from nothing, a screen left
// blurred for over a second, chrome that flipped ahead of the content.
//
// None of those are things a green suite notices, because none of them are
// assertions anybody had written. They are all the same shape of defect:
// during a single flight, two things that should agree disagree. So this
// samples every participant on every frame of a navigation and reports the
// disagreements, rather than checking one number.
//
// Usage: sampleFlight(page, () => click(...)) -> array of frames.

// Everything worth knowing about one animation frame of a flight.
export const FRAME_PROBE = () => {
  const screenEls = [...document.querySelectorAll("[data-flemo-screen]")];
  const screens = screenEls.map((el, index) => {
    const cs = getComputedStyle(el);
    const m = new DOMMatrixReadOnly(cs.transform);
    // A screen's OWN parts must run on the screen's own clock. Comparing every
    // duration in the frame instead would flag flemo's own presets, which are
    // legitimately asymmetric (material enters in 0.35s and exits in 0.25s).
    const partDurations = [
      ...new Set(
        [...el.querySelectorAll("[data-flemo-part-name]")]
          .map((p) => getComputedStyle(p).animationDuration)
          .filter((d) => d !== "0s")
      )
    ];
    const box = el.getBoundingClientRect();
    return {
      index,
      // How much of the frame this screen actually covers right now, 0..1.
      // A screen can be mounted, active and carrying its new body while still
      // sitting off to the side, which is exactly the window in which chrome
      // that changed early looks wrong.
      arrived:
        box.width > 0
          ? Number(
              (
                Math.max(0, Math.min(box.right, innerWidth) - Math.max(box.left, 0)) / box.width
              ).toFixed(2)
            )
          : 0,
      status: el.getAttribute("data-flemo-status"),
      active: el.getAttribute("data-flemo-active"),
      anim: cs.animationName,
      dur: cs.animationDuration,
      partDurations,
      filter: cs.filter,
      // Whether this screen paints its own ground. A transparent screen shows
      // whatever is underneath, including a covered screen still holding the
      // pose its transition parked it in.
      background: cs.backgroundColor,
      opacity: Number(cs.opacity).toFixed(2),
      x: Math.round(m.m41),
      scale: Number(m.a).toFixed(3)
    };
  });

  // Only the bars a person can actually see. Screens below the top stay
  // mounted and keep their own bar element, so counting every bar in the DOM
  // measures stack depth rather than anything about the hand-over.
  const bars = [...document.querySelectorAll("[data-flemo-bar]")]
    .map((el) => {
      const cs = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-flemo-bar-id"),
        transition: el.getAttribute("data-flemo-bar-transition"),
        top: Math.round(box.top),
        height: Math.round(box.height),
        opacity: Number(cs.opacity),
        visible: box.height > 0 && Number(cs.opacity) > 0.02 && cs.visibility !== "hidden",
        text: (el.textContent || "").trim().slice(0, 28)
      };
    })
    .filter((b) => b.visible);

  const parts = [...document.querySelectorAll("[data-flemo-part-name]")]
    .map((el) => {
      const cs = getComputedStyle(el);
      return {
        name: el.getAttribute("data-flemo-part-name"),
        active: el.getAttribute("data-flemo-active"),
        status: el.getAttribute("data-flemo-status"),
        dur: cs.animationDuration,
        opacity: Number(cs.opacity).toFixed(2),
        text: (el.textContent || "").trim().slice(0, 24)
      };
    })
    .filter((p) => p.text);

  // The chrome that lives OUTSIDE the Slot and therefore has no flight of its
  // own to ride. It is the thing most likely to update on the React commit
  // instead of the navigation, which reads as "the header changed before the
  // screen did".
  // The chrome outside the Slot. Its LABEL changing at t=0 is not a defect --
  // you tapped a step, the rail should say so. What matters is whether it moves
  // on the flight's clock or simply snaps while everything else animates, which
  // is what made it read as a separate event from the navigation.
  const railEl = document.querySelector("[data-step-rail-current]");
  const rail = railEl
    ? {
        text: railEl.textContent.trim(),
        // Chrome in this position cannot be a <Part> -- a part in a nested
        // Router's chrome belongs to the OUTER flight by design, and reported
        // the shell's IDLE while these screens flew. So it carries the clock
        // itself, and what the audit reads is its CSS transition.
        dur: getComputedStyle(railEl).transitionDuration.split(",")[0].trim()
      }
    : null;

  // IS A PARKED POSE ACTUALLY VISIBLE?
  //
  // Reading the top screen's own `background-color` is not enough and produced
  // a false positive worth keeping a note about: the `sheet` case gives the
  // arriving screen a transparent background ON PURPOSE, because the content
  // inside it paints its own ground. The attribute said "see-through" while the
  // pixels were solid.
  //
  // So this asks the paint instead. At a few points down the top screen, walk
  // up from whatever is topmost until something actually paints a background,
  // and check which screen that painter belongs to. If it belongs to a screen
  // BELOW the top one, the viewer is looking through.
  const seeThroughAt = (() => {
    const top = screenEls[screenEls.length - 1];
    if (!top || screenEls.length < 2) return 0;
    const box = top.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) return 0;

    let through = 0;
    for (const ratio of [0.25, 0.5, 0.75]) {
      const x = Math.round(box.left + box.width / 2);
      const y = Math.round(box.top + box.height * ratio);
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;

      let el = document.elementFromPoint(x, y);
      let painter = null;
      while (el && el !== document.documentElement) {
        const cs = getComputedStyle(el);
        const bg = cs.backgroundColor;
        // A painter has to be OPAQUE to count. A half-faded screen paints a
        // translucent ground, and everything under it still shows -- which is
        // the whole complaint, so treating it as covered would look past the
        // defect.
        const opaque =
          bg &&
          bg !== "rgba(0, 0, 0, 0)" &&
          bg !== "transparent" &&
          !/rgba\(.*,\s*0?\.\d+\)$/.test(bg);
        if (opaque && Number(cs.opacity) > 0.99) {
          painter = el;
          break;
        }
        el = el.parentElement;
      }
      // Nothing opaque anywhere up the chain means the viewer is looking
      // straight through to whatever is behind the stack.
      if (!painter) {
        through += 1;
        continue;
      }
      const owner = painter.closest("[data-flemo-screen]");
      if (owner && owner !== top) through += 1;
    }
    return through;
  })();

  // DO THE FLYING ELEMENTS LAND ON EACH OTHER?
  //
  // A shared-element pair only reads as one object moving if its two ends keep
  // the same ARRANGEMENT. When they do not -- a poster beside the name at one
  // end and above it at the other -- the two paired elements have to cross, and
  // every mid-flight frame has one sitting on top of the other. That is not a
  // timing defect, so nothing else in this audit sees it; a device recording
  // found it on all six transitions at once.
  //
  // Only NON-NESTED pairs count: a container morph legitimately contains the
  // elements paired inside it.
  const morphOverlap = (() => {
    // Only elements the runtime has actually STAMPED for this flight. The
    // attribute marks every registered morph element, flying or not, and its
    // value is the role: "enter" or "exit" while in flight, empty at rest. A
    // static grid tile is not a participant, and comparing against one measured
    // the layout rather than the flight.
    const flying = [...document.querySelectorAll("[data-flemo-morph]")].filter((el) => {
      const role = el.getAttribute("data-flemo-morph");
      if (role !== "enter" && role !== "exit") return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    });
    let worst = 0;
    for (let i = 0; i < flying.length; i += 1) {
      for (let j = i + 1; j < flying.length; j += 1) {
        const a = flying[i];
        const b = flying[j];
        if (a.contains(b) || b.contains(a)) continue;
        // The two sides of ONE pair are superimposed on purpose -- that is how
        // the cross-fade trades them over -- so only DIFFERENT pairs count. The
        // pair key is an app-side marker: flemo keeps `layoutId` in JS.
        const pa = a.getAttribute("data-morph-pair");
        const pb = b.getAttribute("data-morph-pair");
        if (pa && pb && pa === pb) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w <= 0 || h <= 0) continue;
        const smaller = Math.min(ra.width * ra.height, rb.width * rb.height);
        if (smaller > 0) worst = Math.max(worst, (w * h) / smaller);
      }
    }
    return Number(worst.toFixed(2));
  })();

  return {
    t: Math.round(performance.now()),
    screens,
    bars,
    parts,
    rail,
    seeThroughAt,
    morphOverlap,
    // The body copy of whichever screen is on top, so chrome and content can be
    // compared directly.
    body: (() => {
      const active = [...document.querySelectorAll("[data-flemo-screen]")].filter(
        (el) => el.getAttribute("data-flemo-active") === "true"
      );
      const top = active[active.length - 1];
      return top ? (top.textContent || "").trim().slice(0, 40) : null;
    })()
  };
};

// Sample every animation frame from just before `action` until `ms` later.
export async function sampleFlight(page, action, ms = 1400) {
  await page.evaluate(() => {
    window.__frames = [];
    window.__sampling = true;
    const tick = () => {
      if (!window.__sampling) return;
      window.__frames.push(window.__probe());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await action();
  await page.waitForTimeout(ms);

  return page.evaluate(() => {
    window.__sampling = false;
    return window.__frames;
  });
}

export async function installProbe(page) {
  await page.addInitScript(`window.__probe = ${FRAME_PROBE.toString()}`);
}
