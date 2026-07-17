// Heavy-screen perception harness (MANUAL — not wired into CI).
//
// Measures the content-first contract under mount load: a destination screen
// whose consumer children block the main thread on mount, entered
// mid-transition. The contract — the screen enters with its REAL content in the
// first frame (no blank shell, so blockMs=0 must show no content pop-in), a
// heavy mount DELAYS the transition start by exactly its cost (freezeMs ≈
// blockMs), and the motion then plays IN FULL (intermediateFrames must match the
// blockMs=0 row; the gate re-arm makes a late start immune to the task
// backstop). Drives the playground heavy fixture on chromium + webkit, records a
// Playwright video per run, and measures { intermediateFrames, freezeMs } via
// the tblend-difference motion-energy method (ffmpeg). The freeze is anchored on
// the WALL-CLOCK click tick, because the synchronous block runs in the same JS
// task as the click, so nothing paints (not even a tap marker) until the block
// ends — only wall-clock captures the true delay.
//
// It drives the always-visible playground stress lab (/playground/stress): it
// sets the transition / content-shape / render-cost controls, then clicks the
// primary "Run transition" action, which enters the heavy fixture and flashes the
// perception tap marker in the same tick. The stress lab is first-class,
// always-visible UI, so no gate or opt-in flag is set here.
//
// Matrix: config (webkit+css, chromium+css, chromium+raf) × transition
// (fade, cupertino) × blockMs. css/raf pin flemo's motion driver via the
// diagnostic `flemo:motion-driver-force` localStorage key so both the compositor
// path (production reality on WebKit) and the rAF player are measured on demand.
//
// Usage (from the repo root, after a production build so `next start` serves the
// optimized bundle — dev/Turbopack adds main-thread work that skews timing):
//
//   pnpm --filter @flemo/web build
//   node apps/web/e2e/perception/heavy-shell.mjs            # blocks 0,400,800
//   node apps/web/e2e/perception/heavy-shell.mjs 0 200 800  # custom blocks
//
// Trim the matrix for a single-row spot check with env filters (matched
// case-insensitively):
//
//   FLEMO_ENGINE=webkit FLEMO_DRIVER=css FLEMO_TRANSITION=fade \
//     node apps/web/e2e/perception/heavy-shell.mjs 400
//
// Requires the webkit + chromium Playwright browsers installed
// (`pnpm --filter @flemo/web exec playwright install webkit chromium`). ffmpeg
// comes from the ffmpeg-static devDependency. Videos/meta are written under the
// OS temp dir and cleaned between runs. The script starts `next start` on a
// private port and kills it on exit.

import { execFile, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

import { chromium, webkit } from "@playwright/test";
import ffmpegStatic from "ffmpeg-static";

const execFileP = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
// apps/web/e2e/perception → repo root is four levels up.
const REPO = resolve(HERE, "../../../..");
const FFMPEG = ffmpegStatic;
const OUT = resolve(tmpdir(), "flemo-perception");
const PORT = 41739;
const BASE = `http://127.0.0.1:${PORT}`;

const VIEWPORT = { width: 390, height: 844 };
const SETTLE_MS = 1300;
const POST_MS = 2200;

// Blocks from CLI args (integers), else the default sweep.
const BLOCKS = (() => {
  const args = process.argv
    .slice(2)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  return args.length > 0 ? args : [0, 400, 800];
})();
// `key` is both the stress-lab transition control id (stress-transition-<key>)
// and the printed row label. The lab maps fade → the authored cross-fade and
// cupertino → the built-in slide; the harness only needs the key.
const ALL_TRANSITIONS = [{ key: "fade" }, { key: "cupertino" }];
// engine + forced driver. webkit default is css; chromium default is the rAF
// player. We pin explicitly so the driverPolicy probation never adds variance.
const ALL_CONFIGS = [
  { engine: "webkit", driver: "css" },
  { engine: "chromium", driver: "css" },
  { engine: "chromium", driver: "raf" }
];

// Optional single-row filters for spot checks (see usage note above).
const ENGINE_FILTER = process.env.FLEMO_ENGINE?.toLowerCase();
const DRIVER_FILTER = process.env.FLEMO_DRIVER?.toLowerCase();
const TRANSITION_FILTER = process.env.FLEMO_TRANSITION?.toLowerCase();
const CONFIGS = ALL_CONFIGS.filter(
  (c) =>
    (!ENGINE_FILTER || c.engine === ENGINE_FILTER) && (!DRIVER_FILTER || c.driver === DRIVER_FILTER)
);
const TRANSITIONS = ALL_TRANSITIONS.filter(
  (t) => !TRANSITION_FILTER || t.key === TRANSITION_FILTER
);

// ── server ────────────────────────────────────────────────────────────────
async function startServer() {
  const proc = spawn(
    "pnpm",
    ["--filter", "@flemo/web", "exec", "next", "start", "-p", String(PORT)],
    {
      cwd: REPO,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production" }
    }
  );
  proc.stdout.on("data", () => {});
  proc.stderr.on("data", () => {});
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/playground`, { redirect: "manual" });
      if (res.status >= 200 && res.status < 500) return proc;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error("server did not start");
}

// ── motion-energy analysis ──────────────────────────────────────────────────
async function frameEnergies(videoPath) {
  const metaPath = `${videoPath}.meta.txt`;
  await execFileP(FFMPEG, [
    "-hide_banner",
    "-i",
    videoPath,
    "-vf",
    `tblend=all_mode=difference,signalstats,metadata=print:file=${metaPath}`,
    "-an",
    "-f",
    "null",
    "-"
  ]);
  const text = readFileSync(metaPath, "utf8");
  const frames = [];
  let curT = null;
  for (const line of text.split("\n")) {
    const mt = line.match(/pts_time:([\d.]+)/);
    if (mt) {
      curT = parseFloat(mt[1]);
      continue;
    }
    const my = line.match(/YAVG=([\d.eE+-]+)/);
    if (my && curT !== null) frames.push({ t: curT, y: parseFloat(my[1]) });
  }
  return frames;
}

const TAP = 0.2; // threshold for an "intermediate" motion frame

// Freeze is anchored on the WALL-CLOCK click time (tapWallSec). Video pts_time ≈
// seconds since context start, with a small (~100ms) constant offset vs
// wall-clock that the block=0 control row calibrates.
function analyze(frames, tapWallSec) {
  const win = frames.filter((f) => f.t >= tapWallSec - 0.6);
  if (win.length === 0) return { intermediateFrames: 0, freezeMs: null, note: "empty window" };

  let peak = 0;
  for (const f of win) peak = Math.max(peak, f.y);
  if (peak < 1) return { intermediateFrames: 0, freezeMs: null, note: "no motion" };

  // Transition-onset threshold is a FIXED floor, NOT peak-relative. Shell-first
  // makes the entering transition a (sometimes low-energy) SHELL animation while
  // the highest-energy event is the LATE content landing. A peak-relative bar
  // gets set by that late content and skips right over the earlier transition,
  // reporting the content time as a phantom "freeze". A fixed floor anchors on
  // the transition itself: the fade/slide reliably clears ~10 in the tblend
  // difference, while the corner tap marker (a ~1% white flash) stays near ~3.
  const ONSET = 6;

  const trIdx = win.findIndex((f) => f.y >= ONSET && f.t >= tapWallSec - 0.35);
  if (trIdx < 0)
    return { intermediateFrames: 0, freezeMs: null, note: "no big motion", peak: +peak.toFixed(1) };
  const trT = win[trIdx].t;
  const freezeMs = Math.max(0, Math.round((trT - tapWallSec) * 1000));

  let s = trIdx;
  while (s > 0 && win[s - 1].y >= TAP && win[s - 1].y >= ONSET * 0.15) s--;
  let e = trIdx;
  while (e + 1 < win.length && win[e + 1].y >= TAP) e++;
  const intermediateFrames = e - s + 1;

  let contentIdx = -1;
  for (let i = e + 1; i < win.length; i++) {
    if (win[i].y >= TAP) {
      contentIdx = i;
      break;
    }
  }
  const contentMs = contentIdx >= 0 ? Math.round((win[contentIdx].t - tapWallSec) * 1000) : null;

  return {
    intermediateFrames,
    freezeMs,
    contentMs,
    peak: +peak.toFixed(1),
    signedOnsetMs: Math.round((trT - tapWallSec) * 1000)
  };
}

// ── one scenario ────────────────────────────────────────────────────────────
async function runScenario(browser, cfg, transition, block, tag) {
  const videoDir = `${OUT}/${tag}`;
  mkdirSync(videoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: VIEWPORT }
  });
  const contextStart = Date.now();
  await context.addInitScript((driver) => {
    try {
      localStorage.setItem("flemo:motion-driver-force", driver);
    } catch {
      // ignore
    }
  }, cfg.driver);

  const page = await context.newPage();
  const video = page.video();
  let result;
  try {
    // Deep-link the stress lab (served through the shell's /playground/:n
    // catch-all), then set the transition / atomic-shape / render-cost controls
    // before the timed run so only the final click carries the tap anchor.
    await page.goto(`${BASE}/playground/stress`, { waitUntil: "load", timeout: 30000 });
    await page.waitForSelector(`[data-testid="stress-run"]`, { timeout: 15000 });
    await page.click(`[data-testid="stress-transition-${transition.key}"]`);
    await page.click(`[data-testid="stress-shape-atomic"]`);
    await page.click(`[data-testid="stress-cost-${block}"]`);
    await sleep(SETTLE_MS);

    const tapWallSec = (Date.now() - contextStart) / 1000;
    await page.evaluate(() => {
      document.querySelector(`[data-testid="stress-run"]`).click();
    });
    await sleep(POST_MS);

    await context.close();
    const videoPath = await video.path();
    const frames = await frameEnergies(videoPath);
    result = {
      ...analyze(frames, tapWallSec),
      tapWallSec: +tapWallSec.toFixed(2),
      frameCount: frames.length
    };
  } catch (err) {
    try {
      await context.close();
    } catch {
      // noop
    }
    result = { intermediateFrames: 0, freezeMs: null, note: `error: ${err.message}` };
  }
  return result;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!FFMPEG) throw new Error("ffmpeg-static did not resolve a binary path");
  rmSync(OUT, { recursive: true, force: true });
  const server = await startServer();
  process.stdout.write("server up\n");
  const browsers = {};
  const rows = [];
  try {
    for (const cfg of CONFIGS) {
      const type = cfg.engine === "webkit" ? webkit : chromium;
      if (!browsers[cfg.engine]) browsers[cfg.engine] = await type.launch({ headless: true });
      const browser = browsers[cfg.engine];
      for (const transition of TRANSITIONS) {
        for (const block of BLOCKS) {
          const tag = `${cfg.engine}-${cfg.driver}-${transition.key}-${block}`;
          const r = await runScenario(browser, cfg, transition, block, tag);
          rows.push({
            engine: cfg.engine,
            driver: cfg.driver,
            transition: transition.key,
            block,
            ...r
          });
          process.stdout.write(
            `${tag.padEnd(40)} int=${String(r.intermediateFrames).padStart(3)} ` +
              `freeze=${String(r.freezeMs).padStart(5)}ms ${r.note ? "(" + r.note + ")" : ""}\n`
          );
        }
      }
    }
  } finally {
    for (const b of Object.values(browsers)) {
      try {
        await b.close();
      } catch {
        // noop
      }
    }
    try {
      server.kill("SIGTERM");
    } catch {
      // noop
    }
    await sleep(500);
    try {
      server.kill("SIGKILL");
    } catch {
      // noop
    }
  }

  // Tables: one per config, rows = transition, cols = blocks.
  const fmt = (r) =>
    r ? `${String(r.intermediateFrames).padStart(2)}f/${String(r.freezeMs).padStart(4)}` : "  -  ";
  for (const cfg of CONFIGS) {
    process.stdout.write(
      `\n### ${cfg.engine} / driver=${cfg.driver}   (cell = intermediateFrames / freezeMs)\n`
    );
    process.stdout.write(
      `${"transition".padEnd(16)}${BLOCKS.map((b) => `blk${b}`.padStart(12)).join("")}\n`
    );
    for (const transition of TRANSITIONS) {
      const cells = BLOCKS.map((block) => {
        const r = rows.find(
          (x) =>
            x.engine === cfg.engine &&
            x.driver === cfg.driver &&
            x.transition === transition.key &&
            x.block === block
        );
        return fmt(r).padStart(12);
      });
      process.stdout.write(`${transition.key.padEnd(16)}${cells.join("")}\n`);
    }
  }

  process.stdout.write("\n<<<JSON>>>\n");
  process.stdout.write(`${JSON.stringify(rows)}\n`);
  process.stdout.write("<<<END>>>\n");
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(1);
});
