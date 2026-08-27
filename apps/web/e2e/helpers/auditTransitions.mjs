// The same invariants as the booking audit, applied to the transitions case:
// every screen transition the bench offers, against every morph setting, in
// both directions.
//
//   node e2e/helpers/auditTransitions.mjs [baseURL]
//
// The booking audit walks one flow with five different transitions. This walks
// one flight under eighteen combinations, which is the other half of the claim
// the page makes: a transition and a shared element are separate systems that
// compose, so every cell has to work.

import { chromium } from "@playwright/test";

import { FRAME_PROBE } from "./flightAudit.mjs";

const BASE = process.argv[2] || "http://localhost:3000";
const TRANSITIONS = ["cupertino", "material", "layout", "none", "fade", "sheet"];
const MORPHS = ["off", "shared", "zoom"];

const settled = (s) => s.status === "IDLE" || s.status === "COMPLETED";

function verdict(label, frames) {
  const findings = [];
  if (frames.length < 4) {
    return { label, findings: [{ code: "no_frames", detail: `${frames.length} frames` }] };
  }

  // Each screen's own chrome on that screen's own clock.
  for (const f of frames) {
    for (const s of f.screens) {
      if (s.dur === "0s" || s.partDurations.length === 0) continue;
      const bad = s.partDurations.filter((d) => d !== s.dur);
      if (bad.length) {
        findings.push({
          code: "part_clock_mismatch",
          detail: `screen ${s.dur} vs parts ${bad.join(", ")}`
        });
      }
    }
  }

  // Can a person SEE a parked pose? A covered screen holding the blur its
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

  // A flight that never ends. Every screen has to come to rest -- a morph that
  // lands early and a screen that never releases both show up here.
  if (!last.screens.every(settled)) {
    findings.push({
      code: "never_settled",
      detail: `still ${last.screens.map((s) => s.status).join(",")} after the window`
    });
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

  return { label, findings: dedupe(findings) };
}

const dedupe = (f) => {
  const seen = new Set();
  return f.filter((x) => {
    const k = `${x.code}|${x.detail}`;
    if (seen.has(k)) return false;
    seen.add(k);
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

const report = [];

for (const transition of TRANSITIONS) {
  for (const morph of MORPHS) {
    await tap(page.getByRole("radio", { name: transition, exact: true }));
    await tap(page.getByRole("radio", { name: morph, exact: true }));
    // Either switch remounts the app, so the stack starts clean.
    await page.waitForTimeout(700);

    const push = await sample(page, () =>
      page
        .locator("[data-playground-stage] button")
        .filter({ hasText: "Nightform" })
        .first()
        .click()
    );
    report.push(verdict(`${transition}/${morph} push`, push));

    const pop = await sample(page, async () => {
      const back = page
        .locator('[data-playground-stage] button[aria-label="Back"]:visible')
        .first();
      if ((await back.count()) === 0) throw new Error(`no back control: ${transition}/${morph}`);
      await back.click();
    });
    report.push(verdict(`${transition}/${morph} pop`, pop));
  }
}

await browser.close();

let failed = 0;
for (const r of report) {
  if (!r.findings.length) continue;
  failed += 1;
  process.stdout.write(`FAIL ${r.label}\n`);
  for (const f of r.findings) process.stdout.write(`       - ${f.code}: ${f.detail}\n`);
}
process.stdout.write(`\n${failed} of ${report.length} flights have findings.\n`);
