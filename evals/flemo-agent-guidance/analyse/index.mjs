// READ THE LADDER OUT, ONCE, THE WAY IT WAS REGISTERED.
//
//   node evals/flemo-agent-guidance/analyse/index.mjs \
//     --ledger /absolute/ladder/ledger/ledger.json --reports /absolute/reports \
//     [--sample /absolute/visual-sample.json] [--force]
//
// The endpoint, the comparison and the threshold are read from protocol.json.
// Nothing here chooses them, and nothing here reports a result the protocol did
// not register: no per-criterion league table, no "promising" subgroup, no
// alternative endpoint that happens to be larger.
//
// It also refuses to compute the primary comparison until every planned run has
// a report. That is the stopping rule, and it is the whole reason the number
// means anything: an evaluation that can be read at run 40 and again at run 60
// and again at 96 has three chances to cross a threshold by luck. `--force`
// exists for a ladder that was deliberately stopped, and it stamps the output
// as incomplete so the number can never be quoted as the registered one.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith("--") || token === "--") continue;
  const next = process.argv[i + 1];
  args.set(token.slice(2), next && !next.startsWith("--") ? next : "true");
}
const ledgerPath = args.get("ledger");
const reportsDir = args.get("reports");
if (!ledgerPath || !reportsDir) {
  console.error(
    "usage: analyse/index.mjs --ledger <ledger.json> --reports <dir> [--sample <json>]"
  );
  process.exit(2);
}

const protocol = JSON.parse(await readFile(resolvePath(here, "../protocol.json"), "utf8"));
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));

// Reports are matched to sessions by id, either from the file's own `session`
// field or from its name. A report that matches no planned session is an error
// rather than a curiosity: it means the ladder being read is not the ladder
// that was laid out.
const reports = new Map();
for (const name of await readdir(reportsDir)) {
  if (!name.endsWith(".json")) continue;
  const body = JSON.parse(await readFile(join(reportsDir, name), "utf8"));
  reports.set(body.session ?? name.replace(/\.json$/, ""), body);
}
const planned = new Set(ledger.sessions.map((session) => session.id));
const orphans = [...reports.keys()].filter((id) => !planned.has(id));
if (orphans.length > 0) throw new Error(`reports for unplanned sessions: ${orphans.join(", ")}`);

// A SESSION WITH NO REPORT IS A FAILURE, NOT A GAP.
//
// The stopping rule counts a model or tool failure as a first-pass failure
// unless a provider outage was logged independently. Dropping those runs
// instead is the most common way an evaluation of this kind reports a number
// nobody could reproduce: every session that went badly enough to produce
// nothing quietly leaves the denominator.
const outcomes = ledger.sessions.map((session) => {
  const report = reports.get(session.id);
  return {
    ...session,
    hasReport: Boolean(report),
    outage: Boolean(session.outage),
    success: Boolean(report?.firstPassSuccess),
    scored: report?.scored ?? null,
    criticalFailures: report?.criticalFailures ?? null
  };
});

const counted = outcomes.filter((entry) => !entry.outage);
const missing = counted.filter((entry) => !entry.hasReport);
const complete = missing.length === 0;

const rate = (entries) => {
  const total = entries.length;
  const wins = entries.filter((entry) => entry.success).length;
  return { total, wins, percent: total === 0 ? null : (wins / total) * 100 };
};

// Descriptive only. The registered decision is the threshold below; an interval
// is printed so a reader can see how much of it is sampling noise, not so a
// second rule can be applied after the fact.
const wilson = ({ total, wins }) => {
  if (total === 0) return null;
  const z = 1.96;
  const p = wins / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return [
    Math.max(0, ((centre - spread) / denominator) * 100),
    Math.min(100, ((centre + spread) / denominator) * 100)
  ];
};

const byArm = new Map();
for (const arm of new Set(counted.map((entry) => entry.arm))) {
  byArm.set(arm, rate(counted.filter((entry) => entry.arm === arm)));
}

const [treatment, control] = protocol.primaryEndpoint.comparison.split(" minus ");
const treatmentRate = byArm.get(treatment);
const controlRate = byArm.get(control);
const difference =
  treatmentRate?.percent === null || controlRate?.percent === null
    ? null
    : treatmentRate.percent - controlRate.percent;

const summary = {
  schema: 1,
  protocol: protocol.name,
  endpoint: protocol.primaryEndpoint,
  claimBoundary: protocol.claimBoundary,
  corpus: ledger.corpus,
  providers: ledger.providers,
  // Never pooled: a ladder run with the network on answers a different question
  // and the protocol says to report it on its own.
  pool: ledger.primary ? "primary" : "external-validity",
  complete,
  missingReports: missing.map((entry) => entry.id),
  outages: outcomes.filter((entry) => entry.outage).map((entry) => entry.id),
  arms: Object.fromEntries(
    [...byArm].map(([arm, value]) => [
      arm,
      { ...value, percent: value.percent, descriptiveInterval: wilson(value) }
    ])
  ),
  byProviderAndArm: Object.fromEntries(
    ledger.providers.map((provider) => [
      provider,
      Object.fromEntries(
        [...byArm.keys()].map((arm) => [
          arm,
          rate(counted.filter((entry) => entry.provider === provider && entry.arm === arm))
        ])
      )
    ])
  ),
  comparison:
    complete || args.get("force")
      ? {
          treatment,
          control,
          differencePercentagePoints: difference,
          threshold: protocol.primaryEndpoint.minimumEffectPercentagePoints,
          clearsThreshold:
            difference === null
              ? null
              : difference >= protocol.primaryEndpoint.minimumEffectPercentagePoints,
          incomplete: !complete
        }
      : null
};

// THE BLIND VISUAL SAMPLE, drawn only once the run ids are sealed.
//
// One completed build per provider-by-arm stratum, variants balanced where the
// stratum allows it, labelled with ids that carry nothing. The mapping back to
// arm and provider is written in the same file but under a separate key, so the
// person serving the builds can hand over the labels without the key.
const drawSample = (seed) => {
  let state = Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const picks = [];
  for (const provider of ledger.providers) {
    for (const arm of byArm.keys()) {
      const stratum = counted.filter(
        (entry) => entry.provider === provider && entry.arm === arm && entry.hasReport
      );
      if (stratum.length === 0) continue;
      // Balance variants by preferring one this sample has not shown yet.
      const shown = new Set(picks.map((pick) => pick.variant));
      const fresh = stratum.filter((entry) => !shown.has(entry.variant));
      const pool = fresh.length > 0 ? fresh : stratum;
      picks.push(pool[Math.floor(random() * pool.length)]);
    }
  }
  return picks.map((pick, index) => ({
    label: `build-${createHash("sha256").update(`${seed}:${pick.id}`).digest("hex").slice(0, 8)}`,
    order: index + 1,
    session: pick.id
  }));
};

if (args.get("sample")) {
  if (!complete && !args.get("force")) {
    throw new Error("the visual sample is drawn after every run id is sealed");
  }
  const seed = `${ledger.seed}:visual`;
  const sample = drawSample(seed);
  await writeFile(
    args.get("sample"),
    `${JSON.stringify(
      {
        schema: 1,
        reviewer: protocol.humanVisualGate.reviewer,
        conditions: protocol.humanVisualGate.conditions,
        blinding: protocol.humanVisualGate.blinding,
        criteria: protocol.humanVisualGate.criteria,
        size: sample.length,
        registeredSize: protocol.humanVisualGate.sampleSize,
        labels: sample.map(({ label, order }) => ({ label, order })),
        key: sample
      },
      null,
      2
    )}\n`
  );
}

if (args.get("out")) await writeFile(args.get("out"), `${JSON.stringify(summary, null, 2)}\n`);

console.log(`${summary.pool} pool, ${counted.length} counted session(s)`);
for (const [arm, value] of Object.entries(summary.arms)) {
  const interval = value.descriptiveInterval;
  console.log(
    `  ${arm.padEnd(24)} ${String(value.wins).padStart(3)}/${String(value.total).padEnd(3)} ` +
      `${value.percent === null ? "  -  " : `${value.percent.toFixed(1)}%`}` +
      (interval ? `  [${interval[0].toFixed(0)}, ${interval[1].toFixed(0)}] descriptive` : "")
  );
}
if (!complete) {
  console.log(`\nincomplete: ${missing.length} planned session(s) have no report`);
}
if (summary.comparison) {
  const { differencePercentagePoints: diff, threshold, clearsThreshold } = summary.comparison;
  console.log(
    `\n${treatment} minus ${control}: ${diff === null ? "-" : `${diff.toFixed(1)}pp`} ` +
      `against a registered ${threshold}pp -> ${clearsThreshold ? "clears" : "does not clear"}` +
      (summary.comparison.incomplete ? " (INCOMPLETE, not the registered result)" : "")
  );
} else {
  console.log("\nthe primary comparison is not computed until every planned run has a report");
}
