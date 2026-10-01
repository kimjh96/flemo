// BUILD (10 points, critical)
//
// "Production typecheck and build pass without forbidden dependencies or mocks."
//
// The only criterion that is not read from a running page, because it is about
// what the submission IS rather than what it does. Three separate things can go
// wrong and each one invalidates the rest of the score:
//
//   It does not build. Everything below is then measured on something the
//   session never actually produced.
//
//   It animates with something else. The evaluation asks whether flemo's own
//   guidance is enough; a submission that reaches for another motion library
//   answers a different question, and one that reaches for it ALONGSIDE flemo
//   is the shape that looks like a pass and is not.
//
//   It mocks the library. The corpus ships real published packages precisely so
//   that a stub cannot stand in for them, and the starter says so.

import { spawn } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve as resolvePath } from "node:path";

export const id = "build";

// Named because they are motion runtimes a session might reach for instead of
// the library under test. A submission is free to use anything that is not one.
const FORBIDDEN = [
  "framer-motion",
  "motion",
  "react-spring",
  "@react-spring/web",
  "gsap",
  "animejs",
  "popmotion",
  "react-transition-group",
  "react-router",
  "react-router-dom",
  "next"
];

const MOCK =
  /(vi|jest)\.mock\(\s*["']@flemo\/|__mocks__[/\\]@flemo|["']@flemo\/react["']\s*:\s*["'](?!workspace|file|link|\d)/;

const run = (command, args, cwd) =>
  new Promise((done) => {
    const child = spawn(command, args, { cwd, shell: false });
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (out += chunk));
    child.on("error", (error) => done({ code: 1, out: String(error) }));
    child.on("exit", (code) => done({ code: code ?? 1, out: out.slice(-4000) }));
  });

const sources = async (dir, found = []) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "build", ".next"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await sources(path, found);
    else if (/\.(m?[jt]sx?|json)$/.test(entry.name)) found.push(path);
  }
  return found;
};

export const runCriterion = async ({ submission }) => {
  const failures = [];
  const dir = resolvePath(submission);
  const manifest = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
  const declared = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
    ...(manifest.peerDependencies ?? {})
  };
  for (const name of Object.keys(declared)) {
    if (FORBIDDEN.includes(name)) failures.push(`declares ${name}`);
  }

  for (const file of await sources(dir)) {
    const text = await readFile(file, "utf8");
    if (MOCK.test(text)) failures.push(`mocks the library in ${file.slice(dir.length + 1)}`);
  }

  // The submission's own scripts, so a starter that renames them still runs.
  const scripts = manifest.scripts ?? {};
  for (const name of ["typecheck", "build"]) {
    if (!scripts[name]) {
      failures.push(`no ${name} script`);
      continue;
    }
    const result = await run("npm", ["run", "--silent", name], dir);
    if (result.code !== 0)
      failures.push(`${name} failed: ${result.out.split("\n").slice(-6).join(" ")}`);
  }

  const built = await stat(join(dir, manifest.flemoEval?.outDir ?? "dist")).catch(() => null);
  if (!built) failures.push("no production output directory after build");

  return { pass: failures.length === 0, failures, detail: { declared: Object.keys(declared) } };
};

export { runCriterion as run };
