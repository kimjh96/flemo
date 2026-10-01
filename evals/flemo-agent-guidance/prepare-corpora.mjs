import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const requiredPackages = new Set(["@flemo/core", "@flemo/react", "@flemo/devtools"]);
const armArtifacts = {
  declarations: ["declarations"],
  "declarations-docs": ["declarations", "docs"],
  "declarations-skill": ["declarations", "skill"],
  "declarations-docs-skill": ["declarations", "docs", "skill"]
};

const fail = (message) => {
  throw new Error(message);
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const safeName = (name) => name.replace("@", "").replace("/", "-");

async function walk(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function fetchPinned(source) {
  const response = await fetch(source.url, { redirect: "follow" });
  if (!response.ok) fail(`failed to fetch ${source.url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = sha256(bytes);
  if (actual !== source.sha256) {
    fail(`sha256 mismatch for ${source.url}: expected ${source.sha256}, received ${actual}`);
  }
  return bytes;
}

function validateLock(lock) {
  if (lock.schema !== 1) fail("release lock schema must be 1");
  if (!lock.release || !lock.commit) fail("release lock must pin release and commit");
  const packages = new Map((lock.packages ?? []).map((item) => [item.name, item]));
  for (const name of requiredPackages) {
    const item = packages.get(name);
    if (!item?.version || !item?.integrity?.startsWith("sha512-")) {
      fail(`release lock must pin ${name} version and sha512 integrity`);
    }
  }
  if (!lock.docs?.url || !/^[a-f0-9]{64}$/.test(lock.docs.sha256 ?? "")) {
    fail("release lock must pin the llms-full.txt URL and sha256");
  }
  const skillPaths = new Set((lock.skill?.files ?? []).map(({ path }) => path));
  for (const path of [
    "SKILL.md",
    "references/routing-and-ownership.md",
    "references/composition.md",
    "references/motion-authoring.md",
    "references/verification.md"
  ]) {
    if (!skillPaths.has(path)) fail(`release lock is missing skill file ${path}`);
  }
  for (const source of lock.skill.files) {
    if (!source.url || !/^[a-f0-9]{64}$/.test(source.sha256 ?? "")) {
      fail(`skill file ${source.path} must pin a URL and sha256`);
    }
    const normalized = resolve("/skill", source.path);
    if (!normalized.startsWith(`/skill${sep}`)) fail(`unsafe skill path ${source.path}`);
  }
}

async function packDeclarations(item, destination) {
  const packed = spawnSync(
    "npm",
    [
      "pack",
      `${item.name}@${item.version}`,
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      destination
    ],
    { encoding: "utf8" }
  );
  if (packed.status !== 0) fail(packed.stderr || `npm pack failed for ${item.name}`);
  const result = JSON.parse(packed.stdout)[0];
  if (result.integrity !== item.integrity) {
    fail(`registry integrity mismatch for ${item.name}@${item.version}`);
  }

  const extractRoot = join(destination, `extract-${safeName(item.name)}`);
  await mkdir(extractRoot);
  const extracted = spawnSync(
    "tar",
    ["-xzf", join(destination, result.filename), "-C", extractRoot],
    {
      encoding: "utf8"
    }
  );
  if (extracted.status !== 0) fail(extracted.stderr || `tar extraction failed for ${item.name}`);

  const packageRoot = join(extractRoot, "package");
  const declarations = (await walk(packageRoot)).filter(
    (path) =>
      path.endsWith(".d.ts") &&
      !path.split(sep).includes("__tests__") &&
      !/\.(?:test|spec)\.d\.ts$/.test(path)
  );
  if (declarations.length === 0) fail(`${item.name}@${item.version} contains no declarations`);
  const packageDestination = join(destination, "corpus", "declarations", item.name);
  for (const declaration of declarations) {
    const target = join(packageDestination, relative(packageRoot, declaration));
    await mkdir(dirname(target), { recursive: true });
    await cp(declaration, target);
  }
  return {
    name: item.name,
    version: item.version,
    integrity: item.integrity,
    declarations: declarations.length
  };
}

async function manifestFor(root, sources) {
  const files = {};
  for (const path of await walk(root)) {
    files[relative(root, path)] = sha256(await readFile(path));
  }
  return { schema: 1, sources, files };
}

async function main() {
  const args = process.argv.slice(2);
  const lockIndex = args.indexOf("--lock");
  const outIndex = args.indexOf("--out");
  if (lockIndex < 0 || outIndex < 0 || !args[lockIndex + 1] || !args[outIndex + 1]) {
    fail("usage: node prepare-corpora.mjs --lock <release-lock.json> --out <new-directory>");
  }

  const lockPath = resolve(args[lockIndex + 1]);
  const output = resolve(args[outIndex + 1]);
  try {
    await stat(output);
    fail(`output already exists: ${output}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  validateLock(lock);
  const scratch = await mkdtemp(join(tmpdir(), "flemo-agent-eval-"));
  const staging = await mkdtemp(join(dirname(output), ".flemo-agent-eval-"));

  try {
    const corpus = join(scratch, "corpus");
    await mkdir(join(corpus, "docs"), { recursive: true });
    await mkdir(join(corpus, "skill", "references"), { recursive: true });

    const packages = [];
    for (const item of lock.packages) {
      if (requiredPackages.has(item.name)) packages.push(await packDeclarations(item, scratch));
    }

    await writeFile(join(corpus, "docs", "llms-full.txt"), await fetchPinned(lock.docs));
    for (const source of lock.skill.files) {
      const target = join(corpus, "skill", source.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await fetchPinned(source));
    }

    for (const [arm, artifacts] of Object.entries(armArtifacts)) {
      const armRoot = join(staging, arm);
      await mkdir(armRoot, { recursive: true });
      for (const artifact of artifacts)
        await cp(join(corpus, artifact), join(armRoot, artifact), { recursive: true });
      for (const path of await walk(armRoot)) {
        const name = basename(path);
        if (
          /\.(?:js|jsx|mjs|cjs|tsx)$/.test(name) ||
          (/\.ts$/.test(name) && !name.endsWith(".d.ts"))
        ) {
          fail(`forbidden implementation file leaked into ${arm}: ${relative(armRoot, path)}`);
        }
        if (path.split(sep).includes("__tests__") || /\.(?:test|spec)\.d\.ts$/.test(name)) {
          fail(`test declaration leaked into ${arm}: ${relative(armRoot, path)}`);
        }
      }
    }

    const protocol = await readFile(join(here, "protocol.json"));
    const tasks = await readFile(join(here, "tasks.json"));
    await writeFile(join(staging, "protocol.json"), protocol);
    await writeFile(join(staging, "tasks.json"), tasks);
    const sources = {
      release: lock.release,
      commit: lock.commit,
      packages,
      docs: lock.docs,
      skill: lock.skill
    };
    await writeFile(
      join(staging, "manifest.json"),
      `${JSON.stringify(await manifestFor(staging, sources), null, 2)}\n`
    );
    await rename(staging, output);
    console.log(`prepared four anonymous corpora at ${output}`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
    try {
      await stat(staging);
      await rm(staging, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

await main();
