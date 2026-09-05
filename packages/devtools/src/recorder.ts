import { deriveFlightAnomalies, deriveReportAnomalies, STUCK_STATUS_MS } from "./anomalies";
import { BLIND_SPOTS } from "./blindSpots";
import { summariseBuckets } from "./buckets";
import {
  ACTIVE_ATTR,
  ANIM_HOLD_ATTR,
  attrSelector,
  BAR_ATTR,
  BAR_RIDING_ATTR,
  BAR_STATUS_ATTR,
  DECORATOR_ATTR,
  HOLD_VALUES,
  MORPH_ATTR,
  MORPH_CAMERA_ATTR,
  PART_NAME_ATTR,
  ROUTER_ATTR,
  SCREEN_ATTR,
  STATUS_ATTR,
  TRANSITIONAL_STATUSES
} from "./domProtocol";
import { captureEnvironment, sampleRafCadence } from "./environment";
import {
  createFrameProbeState,
  holdActive,
  motionProgress,
  sampleDriverEvidence,
  sampleProgress
} from "./frameProbe";
import {
  createImageProbeState,
  imageActivity,
  snapshotHeldImages,
  trackAddedImages
} from "./imageProbe";
import { JUDGING_PROTOCOL } from "./judging";
import { auditLanding, LANDING_AUDIT_FRAMES } from "./landingProbe";
import {
  createMorphProbeState,
  morphActivity,
  morphTripwires,
  trackMorphAttribute,
  trackMorphNodes
} from "./morphProbe";
import { deriveOverrideWarnings, snapshotOverrides } from "./overrides";
import { clearTrace, loadTrace, saveTrace } from "./persistence";
import { derivePreconditions } from "./preconditions";
import { classifyDriver, computeFrameStats, kindFromStatus } from "./sampling";
import { attachTripwires, relativeHit } from "./tripwires";
import { deriveVerdict } from "./verdict";

import type { ActiveFlight } from "./flight";
import type {
  FlemoReport,
  FlightKind,
  FlightRecord,
  FlightRecorderHandle,
  FlightRecorderOptions,
  InputEvidence,
  LongTaskSpan,
  Precondition
} from "./types";

// The flight recorder: a PURE CONSUMER of surfaces flemo already exposes —
// `data-flemo-*` attributes, the `flemo:*` storage registry, CSS animation
// events, and standard observers (MutationObserver, PerformanceObserver, rAF).
// It imports nothing from @flemo/core or @flemo/react and changes no behavior;
// attaching it must never alter the motion it measures.
//
// THIS FILE IS THE ORCHESTRATOR AND NOTHING ELSE. Every question it answers
// belongs to a probe module beside it — pacing to frameProbe, images to
// imageProbe, shared elements to morphProbe, one-frame events to tripwires,
// residue to landingProbe — and what is left here is the lifecycle: when a
// flight opens, what it is made of, when it closes, and how a report is
// assembled from the pieces. Adding a new measurement means adding a probe,
// not growing this.

export const REPORT_SCHEMA_VERSION = "3";

const TRANSITIONAL = new Set<string>(TRANSITIONAL_STATUSES);
const HOLD_KINDS = new Set<string>(HOLD_VALUES);
const SCREEN_SELECTOR = attrSelector(SCREEN_ATTR);
const MAX_FRAME_GAPS = 2000;
const MAX_LONG_TASKS = 1000;
/** How often the persisted trace is refreshed while the page sits idle. */
const PERSIST_INTERVAL_MS = 4000;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** The API installed at window.flemo (guarded — see attachFlightRecorder). */
export interface FlemoGlobal {
  /** Marker distinguishing this recorder's global from foreign occupants. */
  __flemoDevtools: true;
  report: () => FlemoReport;
  flights: () => FlightRecord[];
  mark: (bucket: string | null) => string | null;
  detach: () => void;
}

let activeHandle: FlightRecorderHandle | null = null;

const inertReport = (): FlemoReport => ({
  generatedAt: new Date().toISOString(),
  version: REPORT_SCHEMA_VERSION,
  verdict: ["No DOM was available, so nothing could be observed. The recorder ran inert."],
  environment: captureEnvironment({ medianGapMs: null, sampleCount: 0 }),
  preconditions: [],
  overrides: { active: {}, warnings: ["no DOM available — recorder ran inert"] },
  flights: [],
  comparison: [],
  previousSession: null,
  anomalies: [],
  blindSpots: [...BLIND_SPOTS],
  judgingProtocol: [...JUDGING_PROTOCOL]
});

/**
 * Attach the flight recorder. Idempotent: while a recorder is attached,
 * further calls return the SAME handle (their options are ignored). In a
 * non-DOM environment it returns an inert handle whose report carries only
 * the schema constants.
 */
export const attachFlightRecorder = (options: FlightRecorderOptions = {}): FlightRecorderHandle => {
  if (activeHandle) return activeHandle;
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { detach: () => {}, report: inertReport, mark: () => null };
  }

  const maxFlights = options.maxFlights ?? 50;
  const log = options.log ?? false;
  const installGlobal = options.installGlobal ?? true;
  const persist = options.persist ?? true;

  // Overrides are snapshotted at ATTACH as well as at report: the library
  // strips malformed/expired keys on its first decision, so a residue key can
  // vanish before report() runs — exactly the kind of invisible state a
  // session report exists to preserve.
  const attachOverrides = snapshotOverrides();
  const attachedAt = performance.now();
  const previousSession = persist ? loadTrace(REPORT_SCHEMA_VERSION) : null;
  let cadence: { medianGapMs: number | null; sampleCount: number } = {
    medianGapMs: null,
    sampleCount: 0
  };
  void sampleRafCadence().then((result) => {
    cadence = result;
  });

  const longTasks: LongTaskSpan[] = [];
  let longTaskObserver: PerformanceObserver | null = null;
  try {
    if (
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes?.includes("longtask")
    ) {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push({ startMs: round1(entry.startTime), durationMs: round1(entry.duration) });
        }
        if (longTasks.length > MAX_LONG_TASKS)
          longTasks.splice(0, longTasks.length - MAX_LONG_TASKS);
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    }
  } catch {
    longTaskObserver = null;
  }

  const flights: FlightRecord[] = [];
  let flightSeq = 0;
  let current: ActiveFlight | null = null;
  let bucket: string | null = null;
  // Screens a stuck-watchdog finalization locked out of re-arming (see
  // evaluate) — cleared once they leave the transitional statuses.
  let stuckElements: Element[] = [];
  let detached = false;
  let installedGlobal = false;
  let wentHidden = document.visibilityState === "hidden";
  let persistTimer = 0;

  const transitionalScreens = (): Element[] =>
    Array.from(document.querySelectorAll(SCREEN_SELECTOR)).filter((element) =>
      TRANSITIONAL.has(element.getAttribute(STATUS_ATTR) ?? "")
    );

  const busy = (): boolean => current !== null || transitionalScreens().length > 0;

  const countParticipants = (screens: Element[]): FlightRecord["participants"] => {
    const bars = Array.from(document.querySelectorAll(attrSelector(BAR_ATTR))).filter(
      (element) =>
        TRANSITIONAL.has(element.getAttribute(BAR_STATUS_ATTR) ?? "") ||
        element.getAttribute(BAR_RIDING_ATTR) === "true"
    ).length;
    const decorators = Array.from(document.querySelectorAll(attrSelector(DECORATOR_ATTR))).filter(
      (element) => TRANSITIONAL.has(element.getAttribute(STATUS_ATTR) ?? "")
    ).length;
    const parts = Array.from(document.querySelectorAll(attrSelector(PART_NAME_ATTR))).filter(
      (element) => TRANSITIONAL.has(element.getAttribute(STATUS_ATTR) ?? "")
    ).length;
    return { screens: screens.length, bars, decorators, parts };
  };

  // The tripwires run for the WHOLE session, not per flight: an animation
  // cancel can land between flights (that is the interesting case), and the
  // input that caused a navigation always precedes it.
  const tripwires = attachTripwires({
    onHit: (hit) => {
      const flight = current;
      if (!flight) return;
      flight.tripwires.push(relativeHit(hit, flight.t0Ms));
    },
    onAnimationStart: (atMs) => {
      const flight = current;
      if (!flight || flight.firstAnimationAtMs !== null) return;
      flight.firstAnimationAtMs = round1(atMs - flight.t0Ms);
    }
  });

  const currentStuckStatuses = (flight: ActiveFlight): string[] => {
    const statuses = new Set<string>();
    for (const element of flight.elements) {
      const status = element.getAttribute(STATUS_ATTR) ?? "";
      if (TRANSITIONAL.has(status)) statuses.add(status);
    }
    return [...statuses];
  };

  const sampleFrame = () => {
    const flight = current;
    if (!flight || detached) return;
    const now = performance.now();
    const frames = flight.frames;
    if (
      frames.lastFrameAt !== null &&
      frames.heldGaps.length + frames.releasedGaps.length < MAX_FRAME_GAPS
    ) {
      const gapMs = now - frames.lastFrameAt;
      const held = holdActive(flight.elements);
      (held ? frames.heldGaps : frames.releasedGaps).push(gapMs);
      // Progress is only meaningful once the screen is actually moving, and
      // must read the PREVIOUS frame's pose — so it runs before the evidence
      // pass overwrites it.
      if (!held) {
        sampleProgress(frames, flight.elements, gapMs);
        if (frames.releasedFrames === 1) snapshotHeldImages(flight.images, flight.elements);
      }
    }
    frames.lastFrameAt = now;
    sampleDriverEvidence(frames, flight.elements);
    if (now - flight.t0Ms > STUCK_STATUS_MS) {
      // Watchdog: a flight this old is a locked queue, not a navigation.
      // Record it as stuck and stop burning frames; the observer keeps
      // running, so a later recovery starts a fresh flight normally. The
      // locked screens are remembered so the next mutation does not re-arm
      // a duplicate flight on the very same stuck statuses (a locked queue
      // would otherwise fill the bounded buffer and evict real flights).
      stuckElements = [...flight.elements];
      finalizeFlight(now, currentStuckStatuses(flight));
      return;
    }
    flight.rafId = requestAnimationFrame(sampleFrame);
  };

  const beginFlight = (screens: Element[]) => {
    const now = performance.now();
    flightSeq += 1;
    const activeFirst =
      screens.find((element) => element.getAttribute(ACTIVE_ATTR) === "true") ?? screens[0];
    const kind: FlightKind = kindFromStatus(activeFirst.getAttribute(STATUS_ATTR) ?? "") ?? "PUSH";
    let holdKind: string | null = null;
    for (const element of screens) {
      const hold = element.getAttribute(ANIM_HOLD_ATTR);
      if (hold !== null && HOLD_KINDS.has(hold)) {
        holdKind = hold;
        break;
      }
    }
    current = {
      id: `flight-${flightSeq}`,
      kind,
      routerId: activeFirst.getAttribute(ROUTER_ATTR) ?? undefined,
      bucket,
      t0Ms: now,
      t0Iso: new Date().toISOString(),
      elements: [...screens],
      participants: countParticipants(screens),
      holdKind,
      holdReleasedAtMs: null,
      firstAnimationAtMs: null,
      frames: createFrameProbeState(),
      images: createImageProbeState(screens),
      morphs: createMorphProbeState(screens),
      tripwires: [],
      rafId: null
    };
    sampleDriverEvidence(current.frames, current.elements);
    current.rafId = requestAnimationFrame(sampleFrame);
  };

  const scheduleLandingAudit = (record: FlightRecord, elements: Element[]) => {
    let remaining = LANDING_AUDIT_FRAMES;
    const step = () => {
      if (detached) return;
      remaining -= 1;
      if (remaining > 0) {
        requestAnimationFrame(step);
        return;
      }
      const contended = busy();
      const audit = auditLanding(elements, contended);
      record.landing.residualInlineTransforms = audit.residualInlineTransforms;
      record.landing.offViewportAtRest = audit.offViewportAtRest;
      record.landing.orphanedHolds = audit.orphanedHolds;
    };
    requestAnimationFrame(step);
  };

  /**
   * The morph residue audit runs on the same +2rAF beat as the landing audit
   * and for the same reason: the runtime puts its elements back, drops its
   * keyframes and clears its roles in the commits right after the flight, so
   * anything still there then is genuinely left over.
   */
  const scheduleMorphAudit = (record: FlightRecord, flight: ActiveFlight) => {
    let remaining = LANDING_AUDIT_FRAMES;
    const step = () => {
      if (detached) return;
      remaining -= 1;
      if (remaining > 0) {
        requestAnimationFrame(step);
        return;
      }
      record.morphs = morphActivity(flight.morphs, busy());
    };
    requestAnimationFrame(step);
  };

  const buildRecord = (
    flight: ActiveFlight,
    endMs: number,
    stuckStatuses: string[],
    provisional: boolean
  ): FlightRecord => ({
    id: provisional ? `${flight.id} (in flight)` : flight.id,
    ...(flight.routerId !== undefined ? { routerId: flight.routerId } : {}),
    ...(flight.bucket !== null ? { bucket: flight.bucket } : {}),
    kind: flight.kind,
    t0: { ms: round1(flight.t0Ms), iso: flight.t0Iso },
    t1: { ms: round1(endMs), iso: new Date().toISOString() },
    durationMs: round1(endMs - flight.t0Ms),
    driver: classifyDriver(flight.frames.evidence),
    participants: flight.participants,
    holds: { kind: flight.holdKind, releasedAtMs: flight.holdReleasedAtMs },
    frameSamples: computeFrameStats(flight.frames.heldGaps, flight.frames.releasedGaps),
    motion: { ...motionProgress(flight.frames), firstAnimationAtMs: flight.firstAnimationAtMs },
    images: imageActivity(flight.images),
    // The residue half is audited two frames later; until then this is the
    // pairing picture only, which is complete on its own.
    morphs: morphActivity(flight.morphs, true),
    tripwires: [...flight.tripwires, ...morphTripwires(flight.morphs)],
    input: tripwires.inputBetween(flight.t0Ms, endMs),
    longTasks: [], // correlated lazily at report() — entries arrive async
    holdLongTasks: [],
    landing: {
      residualInlineTransforms: [],
      offViewportAtRest: false,
      stuckStatuses,
      orphanedHolds: []
    },
    anomalies: [] // derived lazily at report()
  });

  const finalizeFlight = (endNow: number, stuckStatuses: string[]) => {
    const flight = current;
    if (!flight) return;
    // Last sweep before the numbers are frozen: an image parked late in the
    // flight (or one that arrived mid-flight) must not read as unheld.
    snapshotHeldImages(flight.images, flight.elements);
    current = null;
    if (flight.rafId !== null) cancelAnimationFrame(flight.rafId);
    const record = buildRecord(flight, endNow, stuckStatuses, false);
    flights.push(record);
    if (flights.length > maxFlights) flights.splice(0, flights.length - maxFlights);
    if (stuckStatuses.length === 0) {
      scheduleLandingAudit(record, flight.elements);
      scheduleMorphAudit(record, flight);
    }
    if (log) {
      // eslint-disable-next-line no-console -- opt-in via options.log; the console is the destination.
      console.info(
        `[flemo devtools] ${record.id} ${record.kind} driver=${record.driver} ` +
          `${record.durationMs}ms screens=${record.participants.screens}`
      );
    }
  };

  const trackHoldMutation = (mutation: MutationRecord) => {
    const flight = current;
    if (!flight || !(mutation.target instanceof Element)) return;
    const value = mutation.target.getAttribute(ANIM_HOLD_ATTR);
    if (value !== null && HOLD_KINDS.has(value) && flight.holdKind === null) {
      flight.holdKind = value;
    }
    if (
      value !== null &&
      HOLD_KINDS.has(value) &&
      flight.holdReleasedAtMs !== null &&
      flight.frames.holdReassertedAtMs === null
    ) {
      // A hold going back ON after the release is the 2026-08-18 race: an
      // interleaved commit writing the stale paused attribute over a running
      // flight, which pauses the animation while rAF keeps ticking cleanly.
      const atMs = round1(performance.now() - flight.t0Ms);
      flight.frames.holdReassertedAtMs = atMs;
      flight.tripwires.push({
        kind: "hold-reassert",
        atMs,
        detail:
          "an animation hold was re-asserted after this flight had already released it — the " +
          "motion pauses here while every timing metric stays clean"
      });
    }
    if (
      (value === "false" || value === null) &&
      mutation.oldValue !== null &&
      HOLD_KINDS.has(mutation.oldValue) &&
      flight.holdReleasedAtMs === null &&
      !holdActive(flight.elements)
    ) {
      // The LAST hold released: from here the motion is visible.
      flight.holdReleasedAtMs = round1(performance.now() - flight.t0Ms);
    }
  };

  const evaluate = () => {
    const transitional = transitionalScreens();
    if (stuckElements.length > 0) {
      // A watchdog-finalized queue stays suppressed until its screens
      // actually leave the transitional statuses; only then can a fresh
      // navigation arm a new flight.
      if (transitional.some((element) => stuckElements.includes(element))) return;
      stuckElements = [];
    }
    if (!current && transitional.length > 0) {
      beginFlight(transitional);
      return;
    }
    if (current && transitional.length === 0) {
      finalizeFlight(performance.now(), []);
      return;
    }
    if (current) {
      // A screen can join mid-flight (e.g. the entering screen mounts a
      // beat after the covered one flips) — union it into the participants.
      for (const element of transitional) {
        if (!current.elements.includes(element)) {
          current.elements.push(element);
          // A whole screen can mount after the flight opened. Its childList
          // record was processed before this screen belonged to the flight,
          // so sweep the subtree again now that containment is authoritative.
          trackAddedImages(current.images, current.elements, element.querySelectorAll("img"));
          current.participants = countParticipants(current.elements);
        }
      }
    }
  };

  let observer: MutationObserver | null = null;
  let pendingDomReady: (() => void) | null = null;

  // Wire the mutation observer onto the document root. At document-start
  // (e.g. a Playwright addInitScript, a <head> inline script in a streaming
  // document) `document.documentElement` can still be null and observe()
  // throws "parameter 1 is not of type 'Node'" — so wiring is deferred to
  // DOMContentLoaded when the root isn't there yet. The returned handle is
  // valid either way; only the observation starts late.
  const wireObserver = (): boolean => {
    const root = document.documentElement;
    if (!root) return false;
    const wired = new MutationObserver((mutations) => {
      if (detached) return;
      const now = performance.now();
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          if (mutation.attributeName === ANIM_HOLD_ATTR) {
            trackHoldMutation(mutation);
          } else if (
            current &&
            (mutation.attributeName === MORPH_ATTR ||
              mutation.attributeName === MORPH_CAMERA_ATTR) &&
            mutation.target instanceof Element
          ) {
            trackMorphAttribute(current.morphs, mutation.target);
          }
        } else if (mutation.type === "childList") {
          if (current) trackMorphNodes(current.morphs, mutation, now);
          if (current && mutation.addedNodes.length > 0) {
            trackAddedImages(current.images, current.elements, mutation.addedNodes);
          }
        }
      }
      evaluate();
    });
    try {
      wired.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: [STATUS_ATTR, ACTIVE_ATTR, ANIM_HOLD_ATTR, MORPH_ATTR, MORPH_CAMERA_ATTR]
      });
    } catch {
      // A detached/replaced root: leave the recorder inert rather than throw.
      return false;
    }
    observer = wired;
    // Catch a flight already in progress at wiring time.
    evaluate();
    return true;
  };

  if (!wireObserver()) {
    const onDomReady = () => {
      pendingDomReady = null;
      if (!detached) wireObserver();
    };
    pendingDomReady = onDomReady;
    document.addEventListener("DOMContentLoaded", onDomReady, { once: true });
  }

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      wentHidden = true;
      // Leaving the page is the last chance to keep the trace, and it is also
      // a moment when no flight can be running.
      if (persist && current === null) saveTrace(flights, REPORT_SCHEMA_VERSION);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // Rule 1 of persistence.ts: never write during a flight. The timer simply
  // skips those ticks, so the trace lags a running navigation by one interval
  // and costs nothing on the frames that matter.
  const persistTick = () => {
    persistTimer = 0;
    if (detached) return;
    if (persist && current === null) saveTrace(flights, REPORT_SCHEMA_VERSION);
    persistTimer = window.setTimeout(persistTick, PERSIST_INTERVAL_MS);
  };
  if (persist) persistTimer = window.setTimeout(persistTick, PERSIST_INTERVAL_MS);

  // Split the flight's long tasks on the hold-release boundary: a task fully
  // inside the hold was absorbed by design (the screen is posed, not
  // moving); a task straddling or past the release impinges on visible
  // motion. A hold that never released (releasedAtMs null with a hold kind)
  // makes the whole flight the held phase.
  const correlateLongTasks = (
    record: FlightRecord
  ): { released: LongTaskSpan[]; held: LongTaskSpan[] } => {
    const all = longTasks.filter(
      (task) => task.startMs + task.durationMs >= record.t0.ms - 120 && task.startMs <= record.t1.ms
    );
    const releaseBoundaryMs =
      record.holds.kind === null
        ? record.t0.ms
        : record.holds.releasedAtMs === null
          ? record.t1.ms
          : record.t0.ms + record.holds.releasedAtMs;
    return {
      released: all.filter((task) => task.startMs + task.durationMs > releaseBoundaryMs),
      held: all.filter((task) => task.startMs + task.durationMs <= releaseBoundaryMs)
    };
  };

  /** Long tasks that ran while NO flight was open — the machine's own load. */
  const idleLongTasks = (records: readonly FlightRecord[]): LongTaskSpan[] =>
    longTasks.filter(
      (task) =>
        task.startMs >= attachedAt &&
        !records.some(
          (record) => task.startMs + task.durationMs >= record.t0.ms && task.startMs <= record.t1.ms
        )
    );

  const withDerived = (record: FlightRecord): FlightRecord => {
    const tasks = correlateLongTasks(record);
    const derived: FlightRecord = {
      ...record,
      longTasks: tasks.released,
      holdLongTasks: tasks.held,
      // Copy, don't alias: the +2rAF audits mutate the stored record after
      // finalization, and a report is documented as a point-in-time snapshot —
      // an aliased `landing` would change value in the caller's hands (with
      // anomalies still pre-audit).
      landing: {
        residualInlineTransforms: [...record.landing.residualInlineTransforms],
        offViewportAtRest: record.landing.offViewportAtRest,
        stuckStatuses: [...record.landing.stuckStatuses],
        orphanedHolds: [...record.landing.orphanedHolds]
      },
      morphs: { ...record.morphs },
      tripwires: [...record.tripwires]
    };
    derived.anomalies = deriveFlightAnomalies({
      t0Ms: derived.t0.ms,
      t1Ms: derived.t1.ms,
      driver: derived.driver,
      frameSamples: derived.frameSamples,
      longTasks: derived.longTasks,
      holdLongTasks: derived.holdLongTasks,
      releasedAtMs: derived.holds.releasedAtMs,
      landing: derived.landing,
      motion: derived.motion,
      images: derived.images,
      morphs: derived.morphs,
      tripwires: derived.tripwires
    });
    return derived;
  };

  const materializeFlights = (): FlightRecord[] => {
    const closed = flights.map(withDerived);
    const flight = current;
    if (!flight) return closed;
    // Provisional record for a still-open flight so report() never hides an
    // in-progress (or stuck) navigation.
    const now = performance.now();
    const stuck = now - flight.t0Ms > STUCK_STATUS_MS;
    return [
      ...closed,
      withDerived(buildRecord(flight, now, stuck ? currentStuckStatuses(flight) : [], true))
    ];
  };

  const sessionInput = (records: readonly FlightRecord[]): InputEvidence => {
    const pointerTypes = new Set<string>();
    let trusted = 0;
    let synthetic = 0;
    for (const record of records) {
      trusted += record.input.trusted;
      synthetic += record.input.synthetic;
      for (const type of record.input.pointerTypes) pointerTypes.add(type);
    }
    return { trusted, synthetic, pointerTypes: [...pointerTypes].sort() };
  };

  const report = (): FlemoReport => {
    const nowOverrides = snapshotOverrides();
    const merged: Record<string, string> = { ...nowOverrides };
    for (const [key, value] of Object.entries(attachOverrides)) {
      if (!(key in nowOverrides)) merged[`${key} (at attach, since cleared)`] = value;
    }
    const warnings = deriveOverrideWarnings(merged);
    const environment = captureEnvironment(cadence, tripwires.sawAnimationEvent());
    const flightRecords = materializeFlights();
    const openFlight = current;
    const preconditions: Precondition[] = derivePreconditions({
      environment,
      idleLongTasks: idleLongTasks(flightRecords),
      observedMs: performance.now() - attachedAt,
      wentHidden,
      documentHidden: document.visibilityState === "hidden",
      input: sessionInput(flightRecords)
    });
    return {
      generatedAt: new Date().toISOString(),
      version: REPORT_SCHEMA_VERSION,
      verdict: deriveVerdict({
        preconditions,
        flights: flightRecords,
        observation: environment.observation
      }),
      environment,
      preconditions,
      overrides: { active: merged, warnings },
      flights: flightRecords,
      comparison: summariseBuckets(flightRecords),
      previousSession,
      anomalies: deriveReportAnomalies({
        emulationSuspected: environment.emulationSuspected,
        platform: environment.platform,
        stuckFlightOpen:
          openFlight !== null && performance.now() - openFlight.t0Ms > STUCK_STATUS_MS,
        flightAnomalies: flightRecords.map((record) => record.anomalies)
      }),
      blindSpots: [...BLIND_SPOTS],
      judgingProtocol: [...JUDGING_PROTOCOL]
    };
  };

  const mark = (next: string | null): string | null => {
    bucket = next === null || next === "" ? null : next;
    // A flight already in the air keeps the label it opened under: half a
    // navigation measured under each of two conditions belongs to neither.
    return bucket;
  };

  const detach = () => {
    if (detached) return;
    detached = true;
    observer?.disconnect();
    if (pendingDomReady !== null) {
      document.removeEventListener("DOMContentLoaded", pendingDomReady);
      pendingDomReady = null;
    }
    document.removeEventListener("visibilitychange", onVisibility);
    tripwires.detach();
    longTaskObserver?.disconnect();
    window.clearTimeout(persistTimer);
    persistTimer = 0;
    if (current?.rafId != null) cancelAnimationFrame(current.rafId);
    current = null;
    if (installedGlobal) {
      const slot = window as unknown as { flemo?: { __flemoDevtools?: boolean } };
      if (slot.flemo?.__flemoDevtools === true) delete slot.flemo;
    }
    activeHandle = null;
  };

  const handle: FlightRecorderHandle = { detach, report, mark };

  if (installGlobal) {
    const slot = window as unknown as { flemo?: { __flemoDevtools?: boolean } };
    const occupant = slot.flemo;
    if (occupant === undefined || occupant?.__flemoDevtools === true) {
      const globalApi: FlemoGlobal = {
        __flemoDevtools: true,
        report,
        flights: materializeFlights,
        mark,
        detach
      };
      (slot as { flemo?: FlemoGlobal }).flemo = globalApi;
      installedGlobal = true;
    }
    // A foreign window.flemo is left untouched — the recorder still works
    // through the returned handle.
  }

  activeHandle = handle;
  return handle;
};

export { clearTrace };
