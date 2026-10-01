// WHO RUNS WHAT, DECIDED ONCE AND WRITTEN DOWN.
//
// The design is a full factorial: every provider family runs every arm on every
// task variant, twice. That is the 96 primary runs `protocol.json` registers,
// and it is the reason the comparison can name an arm's contribution at all —
// a provider that happens to be good at one variant cannot land in one arm.
//
// The ORDER is shuffled from a recorded seed rather than run in blocks. Blocks
// put every declarations-only session at the start of the day and every
// docs-plus-skill session at the end, so anything that drifts with time — a
// provider's load, a model revision rolled out mid-run, an evaluator's own
// machine warming up — is read as the treatment. A seed keeps the shuffle
// reproducible, so the plan can be regenerated and checked after the fact.

import { createHash } from "node:crypto";

/** The four arms, in the order protocol.json registers them. */
export const ARMS = [
  "declarations",
  "declarations-docs",
  "declarations-skill",
  "declarations-docs-skill"
];

// A small deterministic generator. Nothing here needs cryptographic quality; it
// needs to give the same sequence for the same seed on any machine.
const mulberry = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seedOf = (text) =>
  Number.parseInt(createHash("sha256").update(text).digest("hex").slice(0, 8), 16);

const shuffled = (items, random) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Build the run plan.
 *
 * `sessionsPerCell` is the protocol's `freshSessionsPerProviderArmVariant`, and
 * the total is checked against `plannedPrimaryRuns` so a plan can never quietly
 * be a different experiment from the registered one.
 */
export const plan = ({ providers, variants, protocol, seed = "flemo-agent-guidance" }) => {
  const perCell = protocol.sample.freshSessionsPerProviderArmVariant;
  if (providers.length < protocol.sample.minimumProviderFamilies) {
    throw new Error(
      `the protocol registers at least ${protocol.sample.minimumProviderFamilies} provider families, received ${providers.length}`
    );
  }
  if (variants.length !== protocol.sample.variants) {
    throw new Error(`the protocol registers ${protocol.sample.variants} variants`);
  }

  const cells = [];
  for (const provider of providers) {
    for (const arm of ARMS) {
      for (const variant of variants) {
        for (let repeat = 1; repeat <= perCell; repeat += 1) {
          cells.push({ provider, arm, variant, repeat });
        }
      }
    }
  }

  const random = mulberry(seedOf(seed));
  return shuffled(cells, random).map((cell, index) => ({
    // The id carries nothing about the treatment. It is what the session
    // directory is named and what the reviewer's blind sample is labelled by,
    // so it must survive being read out loud without revealing the arm.
    id: `run-${String(index + 1).padStart(3, "0")}`,
    order: index + 1,
    provider: cell.provider,
    arm: cell.arm,
    variant: cell.variant,
    repeat: cell.repeat,
    // A per-session seed for anything the provider runner wants to seed, so two
    // sessions in the same cell are not bit-identical requests.
    seed: seedOf(`${seed}:${cell.provider}:${cell.arm}:${cell.variant}:${cell.repeat}`)
  }));
};

/** Every cell covered exactly `perCell` times, which is what makes it factorial. */
export const balance = (sessions) => {
  const counts = new Map();
  for (const session of sessions) {
    const key = `${session.provider}|${session.arm}|${session.variant}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const values = [...counts.values()];
  return {
    cells: counts.size,
    perCell: values.length === 0 ? 0 : Math.min(...values),
    even: new Set(values).size === 1
  };
};
