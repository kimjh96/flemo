// DOES EACH CRITERION ACTUALLY SEPARATE A GOOD BUILD FROM A BROKEN ONE?
//
// A rubric that never fails scores nothing. Every criterion here is run twice
// against the same real application: once as it is, where it must pass, and
// once with a defect injected that the criterion's own sentence names, where it
// must fail. The injection is CSS and DOM only, so the application under test
// is never modified and the defect is exactly the visible symptom the reviewer
// would report, not a stub of it.
//
//   node evals/flemo-agent-guidance/score/selftest.mjs --url <url> --map <json>
//
// The application is this repository's composition bench, addressed through the
// rehearsal map. It is the only flemo app that exists before the first
// submission does; when submissions exist, the same self-test runs against one
// of them instead.

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { resolve } from "./contract.mjs";
import { watchErrors } from "./drive.mjs";
import * as cleanup from "./criteria/cleanup.mjs";
import * as overlayPaint from "./criteria/overlayPaint.mjs";
import * as routerOwnership from "./criteria/routerOwnership.mjs";
import * as sharedChrome from "./criteria/sharedChrome.mjs";
import * as spatialPhase from "./criteria/spatialPhase.mjs";
import * as sharedIdentity from "./criteria/sharedIdentity.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolvePath(here, "../../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

// `pnpm run <script> -- --flag value` forwards a bare `--` of its own, and a
// naive pair walk then reads every flag as the previous flag's value.
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith("--") || token === "--") continue;
  const next = process.argv[i + 1];
  args.set(token.slice(2), next && !next.startsWith("--") ? next : "true");
}
const url = args.get("url");
const map = args.get("map") ? JSON.parse(await readFile(args.get("map"), "utf8")) : null;
if (!url) {
  console.error("usage: selftest.mjs --url <url> [--map <json>]");
  process.exit(2);
}

// Each defect is written as the symptom a reviewer reports, and is expected to
// be caught by the criterion that registered that symptom.
const DEFECTS = [
  {
    id: "doubled-glyphs",
    criterion: sharedIdentity,
    // The runtime dims the copy it carries so the real element shows through
    // it. Undimming it prints both at once, which is the doubling the rubric
    // calls "two boxes cross-fading instead of one identity". The copy carries
    // none of the engine's own markers (a ghost is stripped of everything that
    // would make it pass for the original), so the seed addresses its subtree.
    css: "[data-flemo-morph-ghost] * { opacity: 1 !important; }",
    expect: /painted twice/
  },
  {
    id: "title-under-a-scale",
    criterion: sharedIdentity,
    css: "[data-flemo-morph-layer] [data-flemo-morph-name] { scale: 1.12 !important; }",
    expect: /under a scale/
  },
  {
    id: "console-error",
    criterion: cleanup,
    script: () => {
      window.addEventListener("click", () => console.error("seeded failure"), { once: true });
    },
    expect: /console/
  },
  {
    id: "flight-residue",
    criterion: cleanup,
    // A copy the runtime would have taken away on landing, kept in the layer:
    // the shape a flight that never lands leaves behind.
    script: () => {
      const layer = document.querySelector("[data-flemo-morph-layer]");
      const left = document.createElement("div");
      left.textContent = "residue";
      layer?.appendChild(left);
    },
    expect: /morphLayer still holds/
  },
  {
    id: "local-control-moves-the-app",
    criterion: routerOwnership,
    // The panel's own control pushed onto the ancestor's stack: the defect the
    // criterion is written for, and the one that still animates correctly.
    script: (selectors) => {
      const find = (entry) =>
        [...document.querySelectorAll(entry.selector)].find(
          (node) => !entry.text || (node.textContent ?? "").includes(entry.text)
        );
      const local = find(selectors.local);
      const outer = find(selectors.outer);
      local?.addEventListener(
        "click",
        (event) => {
          event.stopImmediatePropagation();
          event.preventDefault();
          outer?.click();
        },
        true
      );
    },
    expect: /also moved scope|moved no local stack/
  },
  {
    id: "header-shell-moves",
    criterion: sharedChrome,
    // A header that travels with the screen instead of standing still. Written
    // as a running animation so the box differs between the frames a flight is
    // sampled on, which is what "keeps stable geometry" denies.
    // Only while a flight is in the air, so the header still stands still at
    // rest and stays clickable: a permanently moving control is a harness
    // problem, not the defect under test.
    css: `@keyframes flemo-eval-shift { from { transform: none; } to { transform: translateX(40px); } }
          [data-flemo-bar]:not([data-flemo-bar-status="IDLE"]):not([data-flemo-bar-status="COMPLETED"]),
          :root:has([data-flemo-screen][data-flemo-status="POPPING"]) [data-eval="shared-header"],
          :root:has([data-flemo-screen][data-flemo-status="PUSHING"]) [data-eval="shared-header"] {
            animation: flemo-eval-shift 0.7s both !important;
          }`,
    expect: /header shell's x moved/
  },
  {
    id: "title-never-hands-over",
    criterion: sharedChrome,
    titleCss: (selector) => `${selector} { opacity: 1 !important; }`,
    expect: /did not hand over/
  },
  {
    id: "overlay-under-the-chrome",
    criterion: overlayPaint,
    // A dialog written inside the contained content covers that content and
    // stops at its edge, leaving the outer chrome showing. The stacking half of
    // that mistake cannot be induced from a stylesheet on an app that gets it
    // right — the layer host is a sibling of every screen, so nothing inside a
    // screen can be raised over it, which is exactly the invariant the prompts
    // are testing for. So the seed reproduces the CONSEQUENCE a reviewer sees
    // and the criterion asserts against: an overlay that does not reach the
    // header.
    css: `[data-eval="overlay"], [data-testid="composition-layer-overlay"] {
            inset: auto 0 0 0 !important;
            height: 55% !important;
          }`,
    expect: /leaves the header exposed/
  },
  {
    id: "drag-runs-its-own-phase",
    criterion: spatialPhase,
    // The field pinned while a finger is down and left to the flight otherwise:
    // both motions read well on their own and disagree with each other, which
    // is the whole point of comparing them in space.
    script: (selectors) => {
      const style = document.createElement("style");
      style.textContent = `body[data-flemo-eval-dragging] ${selectors.title.selector} { opacity: 1 !important; }`;
      document.head.appendChild(style);
      addEventListener(
        "pointerdown",
        () => document.body.setAttribute("data-flemo-eval-dragging", ""),
        true
      );
      addEventListener(
        "pointerup",
        () => document.body.removeAttribute("data-flemo-eval-dragging"),
        true
      );
    },
    expect: /away from the pop/
  }
];

const browser = await chromium.launch();
const failures = [];

const runOnce = async (criterion, defect) => {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  const errors = watchErrors(page);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  // A defect written against a role rather than an engine surface is given the
  // same selectors the criterion resolves, so the seed and the assertion are
  // always talking about the same element.
  const selectors = {
    title: resolve(map, "shared-title"),
    local: resolve(map, "local-filter"),
    outer: resolve(map, "open-detail-from-local"),
    overlay: resolve(map, "overlay")
  };
  if (defect?.css) await page.addStyleTag({ content: defect.css });
  if (defect?.titleCss)
    await page.addStyleTag({ content: defect.titleCss(selectors.title.selector) });
  if (defect?.script) await page.evaluate(defect.script, selectors);
  // Cleanup reads the state a run is left in, so it needs a flight to have
  // happened; the criteria that drive their own flight ignore this.
  if (criterion === cleanup) {
    await page.locator('[data-flemo-morph-name], [data-eval="shared-object"]').first().click();
    await page.waitForTimeout(1200);
  }
  // A criterion that cannot finish is a criterion that failed, and the reason
  // belongs in its failure list rather than in a stack trace that ends the run.
  let outcome;
  try {
    outcome = await criterion.run({ page, map, errors, url });
  } catch (error) {
    outcome = { pass: false, failures: [`threw: ${error.message.split("\n")[0]}`] };
  }
  await page.close();
  return outcome;
};

for (const criterion of [
  cleanup,
  routerOwnership,
  sharedChrome,
  spatialPhase,
  sharedIdentity,
  overlayPaint
]) {
  const clean = await runOnce(criterion, null);
  console.log(`${clean.pass ? "pass" : "FAIL"}  ${criterion.id} on the untouched build`);
  if (!clean.pass) {
    failures.push(`${criterion.id} fails a build with no defect: ${clean.failures.join(" | ")}`);
  }
}

for (const defect of DEFECTS) {
  const broken = await runOnce(defect.criterion, defect);
  const caught = (broken.failures ?? []).some((failure) => defect.expect.test(failure));
  console.log(
    `${caught ? "pass" : "FAIL"}  ${defect.criterion.id} catches ${defect.id}` +
      (caught ? "" : ` (reported: ${(broken.failures ?? []).join(" | ") || "nothing"})`)
  );
  if (!caught) failures.push(`${defect.criterion.id} missed ${defect.id}`);
}

await browser.close();
if (failures.length > 0) {
  console.error(`\n${failures.length} self-test failure(s)`);
  process.exitCode = 1;
} else {
  console.log("\nevery criterion passed a clean build and caught its own defect");
}
