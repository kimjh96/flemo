// LAY OUT THE LADDER, AND WRITE DOWN WHAT WAS RUN.
//
//   node evals/flemo-agent-guidance/runner/index.mjs \
//     --corpus /absolute/corpora --out /absolute/ladder \
//     --providers alpha,beta,gamma,delta [--seed <text>] [--network off]
//
// This does not talk to a provider. The protocol says any runner may be used,
// as long as each session starts fresh, sees only its own directory, and has no
// network; tying the ladder to one vendor's CLI would make the result a claim
// about that vendor's harness. So this lays out every session's directory and
// writes the ledger, and the operator points their runner at one directory at a
// time. What must be recorded before unblinding is recorded here.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { ARMS, balance, plan } from "./plan.mjs";
import { audit, materialise } from "./workspace.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith("--") || token === "--") continue;
  const next = process.argv[i + 1];
  args.set(token.slice(2), next && !next.startsWith("--") ? next : "true");
}

const corpus = args.get("corpus");
const out = args.get("out");
const providers = (args.get("providers") ?? "").split(",").filter(Boolean);
if (!corpus || !out || providers.length === 0) {
  console.error(
    "usage: runner/index.mjs --corpus <prepared corpora> --out <new directory> --providers a,b,c,d"
  );
  process.exit(2);
}

const protocol = JSON.parse(await readFile(resolvePath(here, "../protocol.json"), "utf8"));
const tasks = JSON.parse(await readFile(resolvePath(here, "../tasks.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(corpus, "manifest.json"), "utf8"));

// The corpus has to be the one the protocol describes, arm for arm: a ladder
// laid out over a corpus missing an arm is four-fifths of an experiment.
for (const arm of ARMS) {
  const present = await stat(join(corpus, arm)).catch(() => null);
  if (!present) throw new Error(`the corpus has no ${arm} directory`);
}

const runtimeVersion =
  manifest.sources?.packages?.find((entry) => entry.name === "@flemo/react")?.version ?? null;
if (!runtimeVersion) throw new Error("the corpus manifest does not pin an @flemo/react version");

const sessions = plan({
  providers,
  variants: tasks.variants.map((variant) => variant.id),
  protocol,
  seed: args.get("seed") ?? manifest.sources.commit
});
const spread = balance(sessions);
if (!spread.even) throw new Error("the plan is not balanced across provider, arm and variant");
if (sessions.length !== protocol.sample.plannedPrimaryRuns) {
  console.error(
    `warning: ${sessions.length} sessions from ${providers.length} providers, against a registered ${protocol.sample.plannedPrimaryRuns}`
  );
}

const network = args.get("network") ?? "off";
const sessionRoot = join(out, "sessions");
const ledgerRoot = join(out, "ledger");
await mkdir(sessionRoot, { recursive: true });
await mkdir(ledgerRoot, { recursive: true });

const started = new Date().toISOString();
const entries = [];
for (const session of sessions) {
  const written = await materialise({
    root: sessionRoot,
    session,
    corpus,
    starter: resolvePath(here, "../starter"),
    tasks,
    runtimeVersion
  });
  const problems = await audit(written.dir);
  if (problems.length > 0) throw new Error(`${session.id}: ${problems.join("; ")}`);
  entries.push({
    ...session,
    // Recorded before unblinding, per the protocol's run manifest: what the
    // session was given, when, and under which conditions. The provider's own
    // model version and exit state are appended by the operator's runner.
    artifacts: written.artifacts,
    runtimeVersion,
    network,
    primary: network === "off",
    preparedAt: started,
    corpusCommit: manifest.sources.commit,
    corpusRelease: manifest.sources.release,
    directory: written.dir
  });
}

const ledger = {
  schema: 1,
  protocol: protocol.name,
  preparedAt: started,
  seed: args.get("seed") ?? manifest.sources.commit,
  providers,
  network,
  // A ladder run with the network on is the external-validity arm, and the
  // protocol forbids pooling it with the primary result.
  primary: network === "off",
  balance: spread,
  corpus: {
    release: manifest.sources.release,
    commit: manifest.sources.commit,
    manifest: createHash("sha256")
      .update(await readFile(join(corpus, "manifest.json")))
      .digest("hex")
  },
  sessions: entries
};
await writeFile(join(ledgerRoot, "ledger.json"), `${JSON.stringify(ledger, null, 2)}\n`);

console.log(
  `laid out ${entries.length} sessions in ${sessionRoot}\n` +
    `  providers ${providers.join(", ")}\n` +
    `  ${spread.cells} cells, ${spread.perCell} session(s) each, balanced: ${spread.even}\n` +
    `  network ${network} (${ledger.primary ? "primary" : "external validity, reported separately"})\n` +
    `  ledger ${join(ledgerRoot, "ledger.json")}`
);
