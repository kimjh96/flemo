// READ-ONLY release-latency observation for LPM-routed compiled flights.
//
// The one honest, unfalsified adaptive lever left after the 2026-08 device
// campaign: every in-flight intervention died on device (WAAPI writes
// demote/desync WebKit's accelerated path; post-birth delay extension
// snaps back — the UI process counts the delay down on its own), so a
// flight's hold must be fully decided BEFORE its animation is born. What
// IS safe is measuring how late this device's presents actually run and
// sizing the NEXT flight's hold from it: the LPM governor schedules
// rendering updates 100-340ms apart at a cold mount with zero long tasks
// (instrumented 2026-08-13), and that distribution is a per-device,
// per-session property a rolling ledger tracks well.
//
// This module only OBSERVES: a MutationObserver catches the anim-hold
// release in its microtask (t0), then a short rAF window records the worst
// tick gap — the release block / governor starvation that ages a compiled
// clock before its first present. The worst gap is reported to the
// lowPowerCadence ledger (reportLpmReleaseLatency) and nothing else is
// touched — no style, no WAAPI, no clocks.

import { reportLpmReleaseLatency } from "@core/engine/lowPowerCadence";

// How long past the release the window keeps watching. Covers the worst
// observed governor gap (340ms) with margin.
const WATCH_WINDOW_MS = 500;

// rAF suspends in background tabs; never leave a watcher armed.
const WATCH_BACKSTOP_MS = 1500;

interface ProbeRecord {
  refs: number;
  pendingDrop: ReturnType<typeof setTimeout> | null;
  dispose: () => void;
}

const probes = new WeakMap<HTMLElement, ProbeRecord>();

export function armLpmReleaseLatencyProbe(scope: HTMLElement): () => void {
  if (
    typeof MutationObserver === "undefined" ||
    typeof requestAnimationFrame !== "function" ||
    typeof performance === "undefined"
  ) {
    return () => {};
  }
  const existing = probes.get(scope);
  if (existing) {
    existing.refs += 1;
    if (existing.pendingDrop !== null) {
      clearTimeout(existing.pendingDrop);
      existing.pendingDrop = null;
    }
    return () => releaseRef(scope);
  }

  let disposed = false;
  let engaged = false;
  let handle = 0;
  let backstop: ReturnType<typeof setTimeout> | null = null;
  let releaseAt = 0;
  let lastTick = 0;
  let worstGap = 0;

  const stop = (report: boolean) => {
    if (handle) {
      cancelAnimationFrame(handle);
      handle = 0;
    }
    if (backstop !== null) {
      clearTimeout(backstop);
      backstop = null;
    }
    if (report && worstGap > 0) reportLpmReleaseLatency(worstGap);
  };

  const tick = () => {
    if (disposed) return;
    const now = performance.now();
    worstGap = Math.max(worstGap, now - lastTick);
    lastTick = now;
    if (now - releaseAt >= WATCH_WINDOW_MS) {
      stop(true);
      return;
    }
    handle = requestAnimationFrame(tick);
  };

  const engage = () => {
    if (engaged || disposed) return;
    engaged = true;
    observer.disconnect();
    releaseAt = performance.now();
    lastTick = releaseAt;
    handle = requestAnimationFrame(tick);
    if (typeof setTimeout === "function") {
      backstop = setTimeout(() => stop(true), WATCH_BACKSTOP_MS);
    }
  };

  const observer = new MutationObserver(() => {
    if (scope.getAttribute("data-flemo-anim-hold") !== "false") return;
    engage();
  });
  if (scope.getAttribute("data-flemo-anim-hold") !== "false") {
    observer.observe(scope, { attributes: true, attributeFilter: ["data-flemo-anim-hold"] });
  }
  // Already released at arm time: the block is behind us and a measurement
  // from NOW would understate it — skip this flight.

  const record: ProbeRecord = {
    refs: 1,
    pendingDrop: null,
    dispose: () => {
      disposed = true;
      observer.disconnect();
      // A torn-down mid-window watch still reports what it saw: a partial
      // worst gap only ever UNDERSTATES, which the rolling max tolerates.
      stop(engaged);
      probes.delete(scope);
    }
  };
  probes.set(scope, record);
  return () => releaseRef(scope);
}

const releaseRef = (scope: HTMLElement) => {
  const record = probes.get(scope);
  if (!record) return;
  record.refs -= 1;
  if (record.refs > 0) return;
  /* v8 ignore next 4 -- setTimeout exists in every runtime under test. */
  if (typeof setTimeout !== "function") {
    record.dispose();
    return;
  }
  if (record.pendingDrop !== null) clearTimeout(record.pendingDrop);
  // Zero-delay grace across the drive effect's release re-run.
  record.pendingDrop = setTimeout(record.dispose, 0);
};
