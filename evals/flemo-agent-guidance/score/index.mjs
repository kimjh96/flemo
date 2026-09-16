// SCORE ONE SUBMISSION'S PRODUCTION BUILD.
//
// The behavioural half of the registered endpoint: a run succeeds only when it
// clears 85 points and every critical criterion, with no repair prompt. The
// rubric and its point values live in protocol.json and are read from there, so
// a criterion cannot quietly re-weight itself here.
//
//   node evals/flemo-agent-guidance/score/index.mjs --url http://localhost:4173 \
//     [--map score/maps/composition-bench.json] [--out report.json] [--only cleanup]
//
// `--map` exists to rehearse the scorer against an app that predates the
// contract (see contract.mjs). A scored run passes no map at all.

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { missingRoles, watchErrors } from "./drive.mjs";
import * as build from "./criteria/build.mjs";
import * as cleanup from "./criteria/cleanup.mjs";
import * as overlayPaint from "./criteria/overlayPaint.mjs";
import * as routerOwnership from "./criteria/routerOwnership.mjs";
import * as sharedChrome from "./criteria/sharedChrome.mjs";
import * as spatialPhase from "./criteria/spatialPhase.mjs";
import * as sharedIdentity from "./criteria/sharedIdentity.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// Playwright is the repository's own pinned browser driver. It is installed for
// the site's end-to-end suite rather than at the root, and the evaluation reuses
// that exact version rather than pinning a second one.
const require = createRequire(resolvePath(here, "../../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

// EACH CRITERION STARTS WHERE THE USER WOULD START, AND CLEANUP GOES LAST.
//
// A criterion leaves the app wherever its last interaction put it, and the next
// one would then be scored on a screen it never asked for. So the page is
// reloaded between them. Cleanup is the exception and the reason for the order:
// it reads the state a run is LEFT in, so it runs after everything else has
// exercised the app, on the page they left behind.
const CRITERIA = [
  build,
  routerOwnership,
  sharedChrome,
  spatialPhase,
  sharedIdentity,
  overlayPaint,
  cleanup
];

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
if (!url) {
  console.error("usage: index.mjs --url <production build url> [--map <json>] [--out <json>]");
  process.exit(2);
}

const protocol = JSON.parse(await readFile(resolvePath(here, "../protocol.json"), "utf8"));
const map = args.get("map") ? JSON.parse(await readFile(args.get("map"), "utf8")) : null;
const only = args.get("only")?.split(",");

const browser = await chromium.launch();
// A phone viewport: an edge swipe is the interaction half of two criteria, and
// the reviewer's own gate is a device review.
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
const errors = watchErrors(page);
await page.goto(url, { waitUntil: "networkidle" });

const results = [];
for (const criterion of CRITERIA) {
  const registered = protocol.scoring.find((entry) => entry.id === criterion.id);
  if (!registered) throw new Error(`${criterion.id} is not a registered criterion`);
  if (only && !only.includes(criterion.id)) continue;
  // The build criterion reads the submission itself. Without one it is NOT
  // scored as a pass: a rehearsal against a hosted app reports what it could
  // not measure, so no total is ever mistaken for a full run.
  if (criterion === build && !args.get("submission")) {
    results.push({ ...registered, pass: false, notRun: true, failures: ["no --submission given"] });
    continue;
  }
  try {
    if (criterion !== cleanup) {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
    }
    const missing = await missingRoles(page, map, criterion.needs ?? []);
    if (missing.length > 0) {
      results.push({
        ...registered,
        pass: false,
        failures: missing.map((name) => `the submission exposes no ${name}`)
      });
      continue;
    }
    const outcome = await criterion.run({
      page,
      map,
      errors,
      url,
      submission: args.get("submission")
    });
    results.push({ ...registered, ...outcome });
  } catch (error) {
    // A criterion that cannot complete is a failed criterion, not a failed run:
    // the stopping rule counts a tool failure as a first-pass failure, and the
    // report has to say which one and why.
    results.push({ ...registered, pass: false, failures: [`threw: ${error.message}`] });
  }
}
await browser.close();

const scored = results.reduce((total, entry) => total + (entry.pass ? entry.points : 0), 0);
const criticalFailures = results.filter((entry) => entry.critical && !entry.pass);
const report = {
  url,
  map: args.get("map") ?? null,
  ranCriteria: results.map((entry) => entry.id),
  scored,
  possible: results.reduce((total, entry) => total + entry.points, 0),
  notRun: results.filter((entry) => entry.notRun).map((entry) => entry.id),
  criticalFailures: criticalFailures.map((entry) => entry.id),
  firstPassSuccess: criticalFailures.length === 0 && scored >= 85,
  results
};

for (const entry of results) {
  console.log(
    `${entry.notRun ? "skip" : entry.pass ? "pass" : "FAIL"}  ${entry.id.padEnd(18)} ${entry.points}pt`
  );
  for (const failure of entry.failures ?? []) console.log(`        - ${failure}`);
}
console.log(
  `\n${report.scored}/${report.possible} points, critical failures: ${criticalFailures.length}`
);
if (args.get("out")) await writeFile(args.get("out"), JSON.stringify(report, null, 2));
