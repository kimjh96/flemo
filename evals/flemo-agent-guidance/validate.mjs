import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const readJson = async (name) => JSON.parse(await readFile(resolve(here, name), "utf8"));

const protocol = await readJson("protocol.json");
const tasks = await readJson("tasks.json");

const errors = [];
const expectedArms = [
  "declarations",
  "declarations-docs",
  "declarations-skill",
  "declarations-docs-skill"
];
const armIds = protocol.arms?.map(({ id }) => id) ?? [];

if (JSON.stringify(armIds) !== JSON.stringify(expectedArms)) {
  errors.push(`arms must be ${expectedArms.join(", ")}`);
}
if (tasks.variants?.length !== protocol.sample?.variants) {
  errors.push("task variant count must match protocol.sample.variants");
}
if ((protocol.sample?.minimumProviderFamilies ?? 0) < 4) {
  errors.push("at least four provider families are required");
}

const expectedRuns =
  protocol.sample?.minimumProviderFamilies *
  protocol.arms?.length *
  protocol.sample?.variants *
  protocol.sample?.freshSessionsPerProviderArmVariant;
if (expectedRuns !== protocol.sample?.plannedPrimaryRuns) {
  errors.push(`plannedPrimaryRuns must equal the factorial design (${expectedRuns})`);
}

const points = protocol.scoring?.reduce((total, criterion) => total + criterion.points, 0);
if (points !== 100) errors.push(`scoring points must total 100, received ${points}`);
if (!protocol.scoring?.every(({ critical }) => critical === true)) {
  errors.push("every registered behavioral criterion must remain fail-critical");
}

const leakedApiNames = /\b(?:Layer|Morph|Part|Slot|sharedTopBar|layoutId)\b/;
for (const variant of tasks.variants ?? []) {
  if (leakedApiNames.test(variant.prompt)) {
    errors.push(`${variant.id} leaks a solution API name in its prompt`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `validated ${protocol.arms.length} arms, ${tasks.variants.length} unseen variants, ${protocol.sample.plannedPrimaryRuns} primary runs, and a ${points}-point rubric`
  );
}
