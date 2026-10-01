// WHAT ONE SESSION IS ALLOWED TO SEE.
//
// A session's whole world is one directory: the task, a reference folder, and a
// starter to build in. Everything about the experiment lives outside it. That
// is not tidiness — it is the measurement. An agent that can see which arm it
// is in, or another arm's folder, or this repository, is answering a different
// question from the one registered.
//
// So the arm's corpus is copied under a fixed name. It is never `declarations`
// or `declarations-docs-skill` on disk: the folder is `reference/` in every
// session, and what is inside it is the only difference between arms. The
// ledger that remembers which arm that was is written somewhere the session
// cannot reach.

import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const TASK = (variant, shared) => `# Task

${shared}

${variant.prompt}

## What you have

- \`reference/\` — the only documentation for this task. Read it before writing code.
- \`submission/\` — a starter application. Build the scene there.

## How this is checked

Your first production build is scored as it stands, with no follow-up prompt.
It is driven at a phone viewport: opened, navigated, popped, and swiped back
from the leading edge, with the browser console watched throughout.
`;

/**
 * Materialise one session's directory.
 *
 * Returns what was written, so the ledger records the shape the session was
 * actually given rather than the shape it was meant to be given.
 */
export const materialise = async ({ root, session, corpus, starter, tasks, runtimeVersion }) => {
  const dir = join(root, session.id);
  await mkdir(dir, { recursive: true });

  // The arm, under a name that is the same in every session.
  await cp(join(corpus, session.arm), join(dir, "reference"), { recursive: true });
  const artifacts = (await readdir(join(dir, "reference"))).sort();

  // The starter, with the runtime pinned to the released version the corpus was
  // cut from: the declarations a session reads and the package it builds
  // against have to be the same release, or the evaluation is measuring a
  // mismatch rather than the guidance.
  await cp(starter, join(dir, "submission"), { recursive: true });
  const manifestPath = join(dir, "submission", "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.dependencies["@flemo/react"] = runtimeVersion;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const variant = tasks.variants.find((entry) => entry.id === session.variant);
  if (!variant) throw new Error(`unknown task variant ${session.variant}`);
  await writeFile(join(dir, "TASK.md"), TASK(variant, tasks.sharedInstruction));

  return { dir, artifacts, variant: variant.id };
};

/**
 * Prove a materialised session gives nothing away.
 *
 * Checked per session rather than trusted, because every leak found in an
 * evaluation of this kind was found after the runs, when the only remedy left
 * was to discard them.
 */
export const audit = async (dir) => {
  const problems = [];
  const names = await readdir(dir);
  for (const name of names) {
    if (!["TASK.md", "reference", "submission"].includes(name)) {
      problems.push(`unexpected entry in the session directory: ${name}`);
    }
  }
  const text = await readFile(join(dir, "TASK.md"), "utf8");
  for (const word of ["declarations", "arm", "skill", "docs"]) {
    // The task must not name the treatment, including by mentioning which
    // artifacts exist: "read the skill" tells a session it is in a skill arm.
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      problems.push(`the task text names the treatment: ${word}`);
    }
  }
  return problems;
};
