// Heavy-screen shell-first perception harness (MANUAL — not wired into CI).
//
// Reproduces the disease shell-first + the rAF-player re-anchor fix: a
// destination screen whose consumer children block the main thread on mount,
// entered mid-transition. Drives the playground heavy fixture on chromium +
// webkit, records a Playwright video per run, and measures
// { intermediateFrames, freezeMs } via the tblend-difference motion-energy
// method (ffmpeg). The freeze is anchored on the WALL-CLOCK click tick, because
// in the diseased baseline the synchronous block runs in the same JS task as the
// click, so nothing paints (not even a tap marker) until the block ends — only
// wall-clock captures the true freeze.
//
// Matrix: config (webkit+css, chromium+css, chromium+raf) × transition
// (tab-forward / fade, cupertino) × blockMs. css/raf pin flemo's motion driver
// via the diagnostic `flemo:motion-driver-force` localStorage key so both the
// compositor path (the disease's production reality on WebKit) and the branch's
// rAF player are measured on demand. Shell-first is unconditional in the shipped
// build, so there is no on/off flag here — compare the printed table against the
// spike's recorded baseline numbers.
//
// Usage (from the repo root, after a production build so `next start` serves the
// optimized bundle — dev/Turbopack adds main-thread work that skews timing):
//
//   pnpm --filter @flemo/web build
//   node apps/web/e2e/perception/heavy-shell.mjs            # blocks 0,400,800
//   node apps/web/e2e/perception/heavy-shell.mjs 0 200 800  # custom blocks
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
const TRANSITIONS = [
  { name: "tab-forward", key: "fade" },
  { name: "cupertino", key: "cupertino" }
];
// engine + forced driver. webkit default is css; chromium default is the rAF
// player. We pin explicitly so the driverPolicy probation never adds variance.
//
// `driver: "default"` pins NOTHING (no force key) — it measures chromium's real
// production path, where the driver is auto-selected. This is the row that
// proves the shell-first compositor takeover: the fixture's heavy screen always
// defers, so under automatic selection the transition DECLINES the rAF player
// and the compiled-CSS compositor drives both sides (freeze collapses to the
// css numbers). The forced "raf" row does NOT collapse — the diagnostic pin
// deliberately OVERRIDES the takeover (a debugger can still force the player
// onto a heavy transition to reproduce the snap), so it stays the diseased
// baseline. Compare "default" vs "raf" to see the fix; "raf" documents that the
// pin wins.
const CONFIGS = [
  { engine: "webkit", driver: "css" },
  { engine: "chromium", driver: "css" },
  { engine: "chromium", driver: "raf" },
  { engine: "chromium", driver: "default" }
];

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
  await context.addInitScript(() => {
    localStorage.setItem("flemo:spike-harness", "1");
  });
  await context.addInitScript((driver) => {
    try {
      // "default" = no pin: measure automatic driver selection (the production
      // path). Clear any persisted demotion too so probation never adds
      // variance to the auto-selected run.
      if (driver === "default") {
        localStorage.removeItem("flemo:motion-driver-force");
        localStorage.removeItem("flemo:motion-driver");
      } else {
        localStorage.setItem("flemo:motion-driver-force", driver);
      }
    } catch {
      // ignore
    }
  }, cfg.driver);

  const page = await context.newPage();
  const video = page.video();
  let result;
  try {
    await page.goto(`${BASE}/playground`, { waitUntil: "load", timeout: 30000 });
    await page.waitForSelector(`[data-testid="spike-${transition.key}-${block}"]`, {
      timeout: 15000
    });
    await sleep(SETTLE_MS);

    const tapWallSec = (Date.now() - contextStart) / 1000;
    await page.evaluate((sel) => {
      document.querySelector(sel).click();
    }, `[data-testid="spike-${transition.key}-${block}"]`);
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
