// Drive the booking flow all the way down and all the way back, sampling every
// frame, and report the disagreements. Run against a build to see whether the
// flow is actually smooth rather than merely green.
//
//   node e2e/helpers/auditBooking.mjs [baseURL]

import { chromium } from "@playwright/test";

import { FRAME_PROBE } from "./flightAudit.mjs";

const BASE = process.argv[2] || "http://localhost:3000";
const STEPS = ["event", "seats", "extras", "review", "done"];

const settled = (s) => s.status === "IDLE" || s.status === "COMPLETED";

// One flight's worth of frames, reduced to the facts worth arguing about.
function verdict(label, frames) {
  const findings = [];
  if (frames.length < 4) {
    findings.push({ code: "no_frames", detail: `only ${frames.length} frames sampled` });
    return { label, findings, frames: frames.length };
  }

  // 1. Does the chrome outside the Slot ride the flight, or just snap?
  //
  //    An earlier version of this check compared WHEN the rail label changed
  //    against when the arriving screen was half on screen, and flagged a gap.
  //    That check was wrong: the label changes on the React commit at t=0 and
  //    the screen arrives over the flight's duration, so the gap is the
  //    transition itself. It fired on every healthy flight and would have been
  //    "fixed" by making the rail lie about where the stack is.
  //
  //    The real invariant is that the rail MOVES WITH the flight. A rail that
  //    snaps while the screens animate reads as a separate event; one that runs
  //    the same clock reads as part of the same one.
  const railChange = frames.findIndex((f, i) => i > 0 && f.rail?.text !== frames[0].rail?.text);
  if (railChange >= 0) {
    const flying = frames
      .slice(railChange)
      .find((f) => f.screens.some((s) => s.dur !== "0s") && f.rail);
    if (flying) {
      const screenDur = flying.screens.find((s) => s.dur !== "0s").dur;
      if (flying.rail.dur !== screenDur) {
        findings.push({
          code: "chrome_off_clock",
          detail: `the rail ran ${flying.rail.dur} while its screens ran ${screenDur}`
        });
      }
    }
  }

  // 2. Does each screen's own chrome run on that screen's own clock?
  //    Comparing every duration in the frame would flag flemo's own presets,
  //    which are legitimately asymmetric: material enters in 0.35s and exits in
  //    0.25s, and two screens in one flight are on opposite sides of that. The
  //    invariant that actually matters is per screen.
  for (const f of frames) {
    for (const s of f.screens) {
      if (s.dur === "0s" || s.partDurations.length === 0) continue;
      const mismatched = s.partDurations.filter((d) => d !== s.dur);
      if (mismatched.length) {
        findings.push({
          code: "part_clock_mismatch",
          detail: `a screen animating ${s.dur} carries parts running ${mismatched.join(", ")}`
        });
      }
    }
  }

  // 3. Can a person SEE a parked pose? A covered screen holding the blur its
  //    transition parked it in is correct -- that is what `exit` means, and
  //    `exitBack` undoes it on the way out. It becomes a defect only when the
  //    viewer can look THROUGH the screen on top and see it.
  //
  //    Decided from the paint, not from an attribute: the `sheet` case makes
  //    its arriving screen transparent on purpose and lets the content inside
  //    paint the ground, so `background-color` alone called three healthy
  //    flights broken.
  const last = frames[frames.length - 1];
  if (last.screens.every(settled) && last.seeThroughAt > 0) {
    const parked = last.screens
      .slice(0, -1)
      .filter((s) => (s.filter && s.filter !== "none") || Number(s.scale) !== 1);
    if (parked.length) {
      findings.push({
        code: "parked_pose_visible",
        detail: `${last.seeThroughAt} of 3 sampled points look through to a screen that is ${parked[0].filter} / scale ${parked[0].scale}`
      });
    }
  }

  // 4. Did the visible bar vanish and come back? A bar with no counterpart on
  //    the other side of the flight cannot hand over -- it can only pop in.
  const visibleBars = frames.map((f) => f.bars.length);
  const vanished = visibleBars.some((c, i) => i > 0 && c === 0 && visibleBars[i - 1] > 0);
  const returned = visibleBars.some((c, i) => i > 0 && c > 0 && visibleBars[i - 1] === 0);
  if (vanished && returned) {
    findings.push({
      code: "bar_vanished_and_returned",
      detail: "the visible bar dropped to zero mid-flight and came back"
    });
  } else if (visibleBars[0] > 0 && visibleBars[visibleBars.length - 1] === 0) {
    findings.push({
      code: "bar_lost",
      detail: "the flight ended with no visible bar where one started"
    });
  } else if (visibleBars[0] === 0 && visibleBars[visibleBars.length - 1] > 0) {
    findings.push({
      code: "bar_appeared",
      detail: "a bar appeared where none existed, so nothing handed over to it"
    });
  }

  // 5. Did a bar render somewhere other than the top of the frame? A shared bar
  //    that mounts before its position resolves lands in flow position, which
  //    on screen is the header appearing in the middle of the content.
  for (const f of frames) {
    for (const b of f.bars) {
      if (b.height > 0 && b.top > 200) {
        findings.push({
          code: "bar_misplaced",
          detail: `a bar rendered at top=${b.top}px mid-flight`
        });
      }
    }
  }

  // NOT CHECKED HERE: whether paired elements travel through one another.
  //
  // It was the defect a device recording found -- a poster beside the name at
  // one end and above it at the other, so the two crossed and every mid-flight
  // frame had one dumped on the other. Three formulations were tried (peak
  // overlap, sustained overlap, overlap excluding same-pair and non-flying
  // elements) and each one flagged healthy flights: a container and its
  // children legitimately fly together under `zoom`, and a poster growing to a
  // hero legitimately sweeps past the name below it.
  //
  // Tuning a check until it agrees with the current build is how a regression
  // becomes a specification. So it is left out, and the arrangement rule it
  // tried to encode is enforced where it can be judged honestly: the two ends
  // of a pair keep the same stacking order (see Poster.tsx), and the frame
  // comparison in the visual pass is what catches a violation.

  return { label, findings: dedupe(findings), frames: frames.length };
}

const dedupe = (findings) => {
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.code}|${f.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

async function sample(page, action, ms = 1500) {
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

const browser = await chromium.launch();
// Viewport is a parameter, not a constant: the first audits ran at one size
// while the recording that found the next defect was another, and a harness
// that only ever looks at one size has a blind spot.
//
// KNOWN LIMIT: this driver cannot reliably operate the page below ~700px wide.
// At 678px the case rail reports a box that `elementFromPoint` finds nothing
// at, so clicks land on the shell instead of the control, and no amount of
// scrolling fixes it. The cause is unresolved. Narrow widths are covered by the
// visual frame pass instead -- which is what found the last defect anyway.
const [W, H] = (process.env.AUDIT_VIEWPORT || "700x1200").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript(`window.__probe = ${FRAME_PROBE.toString()}`);
await page.goto(`${BASE}/playground`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Put a control in the middle of the viewport before clicking it. The site
// header is fixed and translucent, so content scrolls UNDER it by design --
// and Playwright's auto-scroll parks an element right there, where the header
// swallows the click. Centring is about driving the page, not about the page
// being wrong.
// Reveal, then click by COORDINATE. Playwright's own auto-scroll re-parks the
// element under the header after the reveal, so the click has to happen at a
// position we chose rather than one it picks.
// Plain clicks: Playwright's own auto-scroll handles this at the supported
// width. A coordinate-clicking helper was tried for narrow viewports and broke
// the supported one too, which is why the limit above is documented rather
// than worked around.
const tap = (locator) => locator.click();
await tap(page.getByRole("tab", { name: /A stack|스택/ }));
await page.waitForTimeout(1200);

const report = [];

for (const step of STEPS) {
  const frames = await sample(page, () => page.locator(`[data-booking-next="${step}"]`).click());
  report.push(verdict(`push -> ${step}`, frames));
}

for (let i = STEPS.length - 1; i >= 0; i -= 1) {
  let missingBack = false;
  const frames = await sample(page, async () => {
    // The visible one: screens below the top keep their own back control in the
    // DOM, and a stale match clicks nothing while the audit reports frames.
    const back = page.locator('[data-playground-stage] button[aria-label="Back"]:visible').first();
    // Recorded rather than thrown: a missing back control IS a finding (the
    // step lost its header), and aborting here would hide every other flight.
    if ((await back.count()) === 0) {
      missingBack = true;
      return;
    }
    await back.click();
  });
  const r = verdict(`pop <- ${STEPS[i]}`, frames);
  if (missingBack) {
    r.findings.unshift({
      code: "no_back_control",
      detail: "this step has no visible back control, so its header is gone"
    });
  }
  report.push(r);
}

await browser.close();

let failed = 0;
for (const r of report) {
  const mark = r.findings.length ? "FAIL" : "ok  ";
  if (r.findings.length) failed += 1;
  process.stdout.write(`${mark} ${r.label.padEnd(18)} (${r.frames} frames)\n`);
  for (const f of r.findings) process.stdout.write(`       - ${f.code}: ${f.detail}\n`);
}
process.stdout.write(`\n${failed} of ${report.length} flights have findings.\n`);
