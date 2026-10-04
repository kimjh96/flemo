import { deriveTransitionAnomalies, deriveReportAnomalies, STUCK_STATUS_MS } from "./anomalies";
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
  sampleMorphPaint,
  trackMorphNodes
} from "./morphProbe";
import { deriveOverrideWarnings, snapshotOverrides } from "./overrides";
import { clearTrace, loadTrace, saveTrace } from "./persistence";
import { derivePreconditions } from "./preconditions";
import { classifyDriver, computeFrameStats, kindFromStatus } from "./sampling";
import { attachTripwires, relativeHit } from "./tripwires";
import { deriveVerdict } from "./verdict";

import type { ActiveTransition } from "./transition";
import type {
  FlemoReport,
  TransitionKind,
  TransitionRecord,
  TransitionRecorderHandle,
  TransitionRecorderOptions,
  InputEvidence,
  LongTaskSpan,
  Precondition
} from "./types";

// The transition recorder: a PURE CONSUMER of surfaces flemo already exposes —
// `data-flemo-*` attributes, the `flemo:*` storage registry, CSS animation
// events, and standard observers (MutationObserver, PerformanceObserver, rAF).
// It imports nothing from @flemo/core or @flemo/react and changes no behavior;
// attaching it must never alter the motion it measures.
//
// THIS FILE IS THE ORCHESTRATOR AND NOTHING ELSE. Every question it answers
// belongs to a probe module beside it — pacing to frameProbe, images to
// imageProbe, shared elements to morphProbe, one-frame events to tripwires,
// residue to landingProbe — and what is left here is the lifecycle: when a
// transition opens, what it is made of, when it closes, and how a report is
// assembled from the pieces. Adding a new measurement means adding a probe,
// not growing this.

export const REPORT_SCHEMA_VERSION = "4";

const TRANSITIONAL = new Set<string>(TRANSITIONAL_STATUSES);
const HOLD_KINDS = new Set<string>(HOLD_VALUES);
const SCREEN_SELECTOR = attrSelector(SCREEN_ATTR);
const MAX_FRAME_GAPS = 2000;
const MAX_LONG_TASKS = 1000;
/** How often the persisted trace is refreshed while the page sits idle. */
const PERSIST_INTERVAL_MS = 4000;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** The API installed at window.flemo (guarded — see attachTransitionRecorder). */
export interface FlemoGlobal {
  /** Marker distinguishing this recorder's global from foreign occupants. */
  __flemoDevtools: true;
  report: () => FlemoReport;
  transitions: () => TransitionRecord[];
  mark: (bucket: string | null) => string | null;
  detach: () => void;
}

let activeHandle: TransitionRecorderHandle | null = null;

const inertReport = (): FlemoReport => ({
  generatedAt: new Date().toISOString(),
  version: REPORT_SCHEMA_VERSION,
  verdict: ["No DOM was available, so nothing could be observed. The recorder ran inert."],
  environment: captureEnvironment({ medianGapMs: null, sampleCount: 0 }),
  preconditions: [],
  overrides: { active: {}, warnings: ["no DOM available — recorder ran inert"] },
  transitions: [],
  comparison: [],
  previousSession: null,
  anomalies: [],
  blindSpots: [...BLIND_SPOTS],
  judgingProtocol: [...JUDGING_PROTOCOL]
});

/**
 * Attach the transition recorder. Idempotent: while a recorder is attached,
 * further calls return the SAME handle (their options are ignored). In a
 * non-DOM environment it returns an inert handle whose report carries only
 * the schema constants.
 */
export const attachTransitionRecorder = (
  options: TransitionRecorderOptions = {}
): TransitionRecorderHandle => {
  if (activeHandle) return activeHandle;
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { detach: () => {}, report: inertReport, mark: () => null };
  }

  const maxTransitions = options.maxTransitions ?? 50;
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

  const transitions: TransitionRecord[] = [];
  let transitionSeq = 0;
  let current: ActiveTransition | null = null;
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

  const countParticipants = (screens: Element[]): TransitionRecord["participants"] => {
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

  // The tripwires run for the WHOLE session, not per transition: an animation
  // cancel can land between transitions (that is the interesting case), and the
  // input that caused a navigation always precedes it.
  const tripwires = attachTripwires({
    onHit: (hit) => {
      const transition = current;
      if (!transition) return;
      transition.tripwires.push(relativeHit(hit, transition.t0Ms));
    },
    onAnimationStart: (atMs) => {
      const transition = current;
      if (!transition || transition.firstAnimationAtMs !== null) return;
      transition.firstAnimationAtMs = round1(atMs - transition.t0Ms);
    }
  });

  const currentStuckStatuses = (transition: ActiveTransition): string[] => {
    const statuses = new Set<string>();
    for (const element of transition.elements) {
      const status = element.getAttribute(STATUS_ATTR) ?? "";
      if (TRANSITIONAL.has(status)) statuses.add(status);
    }
    return [...statuses];
  };

  const sampleFrame = () => {
    const transition = current;
    if (!transition || detached) return;
    const now = performance.now();
    const frames = transition.frames;
    if (
      frames.lastFrameAt !== null &&
      frames.heldGaps.length + frames.releasedGaps.length < MAX_FRAME_GAPS
    ) {
      const gapMs = now - frames.lastFrameAt;
      const held = holdActive(transition.elements);
      (held ? frames.heldGaps : frames.releasedGaps).push(gapMs);
      // Progress is only meaningful once the screen is actually moving, and
      // must read the PREVIOUS frame's pose — so it runs before the evidence
      // pass overwrites it.
      if (!held) {
        sampleProgress(frames, transition.elements, gapMs);
        if (frames.releasedFrames === 1) snapshotHeldImages(transition.images, transition.elements);
      }
    }
    frames.lastFrameAt = now;
    sampleDriverEvidence(frames, transition.elements);
    // What the transition is PAINTING, which the role sightings cannot answer: a
    // departure still on glass, and a part sitting narrower than the box
    // carrying it. Both are defects this recorder watched happen in silence.
    sampleMorphPaint(transition.morphs);
    if (now - transition.t0Ms > STUCK_STATUS_MS) {
      // Watchdog: a transition this old is a locked queue, not a navigation.
      // Record it as stuck and stop burning frames; the observer keeps
      // running, so a later recovery starts a fresh transition normally. The
      // locked screens are remembered so the next mutation does not re-arm
      // a duplicate transition on the very same stuck statuses (a locked queue
      // would otherwise fill the bounded buffer and evict real transitions).
      stuckElements = [...transition.elements];
      finalizeTransition(now, currentStuckStatuses(transition));
      return;
    }
    transition.rafId = requestAnimationFrame(sampleFrame);
  };

  const beginTransition = (screens: Element[]) => {
    const now = performance.now();
    transitionSeq += 1;
    const activeFirst =
      screens.find((element) => element.getAttribute(ACTIVE_ATTR) === "true") ?? screens[0];
    const kind: TransitionKind =
      kindFromStatus(activeFirst.getAttribute(STATUS_ATTR) ?? "") ?? "PUSH";
    let holdKind: string | null = null;
    for (const element of screens) {
      const hold = element.getAttribute(ANIM_HOLD_ATTR);
      if (hold !== null && HOLD_KINDS.has(hold)) {
        holdKind = hold;
        break;
      }
    }
    current = {
      id: `transition-${transitionSeq}`,
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

  const scheduleEndAudit = (record: TransitionRecord, elements: Element[]) => {
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
      record.endAudit.residualInlineTransforms = audit.residualInlineTransforms;
      record.endAudit.offViewportAtRest = audit.offViewportAtRest;
      record.endAudit.orphanedHolds = audit.orphanedHolds;
    };
    requestAnimationFrame(step);
  };

  /**
   * The morph residue audit runs on the same +2rAF beat as the landing audit
   * and for the same reason: the runtime puts its elements back, drops its
   * keyframes and clears its roles in the commits right after the transition, so
   * anything still there then is genuinely left over.
   */
  const scheduleMorphAudit = (record: TransitionRecord, transition: ActiveTransition) => {
    let remaining = LANDING_AUDIT_FRAMES;
    const step = () => {
      if (detached) return;
      remaining -= 1;
      if (remaining > 0) {
        requestAnimationFrame(step);
        return;
      }
      record.morphs = morphActivity(transition.morphs, busy());
    };
    requestAnimationFrame(step);
  };

  const buildRecord = (
    transition: ActiveTransition,
    endMs: number,
    stuckStatuses: string[],
    provisional: boolean
  ): TransitionRecord => ({
    id: provisional ? `${transition.id} (running)` : transition.id,
    ...(transition.routerId !== undefined ? { routerId: transition.routerId } : {}),
    ...(transition.bucket !== null ? { bucket: transition.bucket } : {}),
    kind: transition.kind,
    t0: { ms: round1(transition.t0Ms), iso: transition.t0Iso },
    t1: { ms: round1(endMs), iso: new Date().toISOString() },
    durationMs: round1(endMs - transition.t0Ms),
    driver: classifyDriver(transition.frames.evidence),
    participants: transition.participants,
    holds: { kind: transition.holdKind, releasedAtMs: transition.holdReleasedAtMs },
    frameSamples: computeFrameStats(transition.frames.heldGaps, transition.frames.releasedGaps),
    motion: {
      ...motionProgress(transition.frames),
      firstAnimationAtMs: transition.firstAnimationAtMs
    },
    images: imageActivity(transition.images),
    // The residue half is audited two frames later; until then this is the
    // pairing picture only, which is complete on its own.
    morphs: morphActivity(transition.morphs, true),
    tripwires: [...transition.tripwires, ...morphTripwires(transition.morphs)],
    input: tripwires.inputBetween(transition.t0Ms, endMs),
    longTasks: [], // correlated lazily at report() — entries arrive async
    holdLongTasks: [],
    endAudit: {
      residualInlineTransforms: [],
      offViewportAtRest: false,
      stuckStatuses,
      orphanedHolds: []
    },
    anomalies: [] // derived lazily at report()
  });

  const finalizeTransition = (endNow: number, stuckStatuses: string[]) => {
    const transition = current;
    /* v8 ignore next -- unreachable: both callers hold a transition. sampleFrame
       returns at its own top when `current` is null, and evaluate only calls
       this inside `if (current && ...)`. The narrowing stays for the type. */
    if (!transition) return;
    // Last sweep before the numbers are frozen: an image parked late in the
    // transition (or one that arrived mid-transition) must not read as unheld.
    snapshotHeldImages(transition.images, transition.elements);
    current = null;
    if (transition.rafId !== null) cancelAnimationFrame(transition.rafId);
    const record = buildRecord(transition, endNow, stuckStatuses, false);
    transitions.push(record);
    if (transitions.length > maxTransitions)
      transitions.splice(0, transitions.length - maxTransitions);
    if (stuckStatuses.length === 0) {
      scheduleEndAudit(record, transition.elements);
      scheduleMorphAudit(record, transition);
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
    const transition = current;
    if (!transition || !(mutation.target instanceof Element)) return;
    const value = mutation.target.getAttribute(ANIM_HOLD_ATTR);
    if (value !== null && HOLD_KINDS.has(value) && transition.holdKind === null) {
      transition.holdKind = value;
    }
    if (
      value !== null &&
      HOLD_KINDS.has(value) &&
      transition.holdReleasedAtMs !== null &&
      transition.frames.holdReassertedAtMs === null
    ) {
      // A hold going back ON after the release is the 2026-08-18 race: an
      // interleaved commit writing the stale paused attribute over a running
      // transition, which pauses the animation while rAF keeps ticking cleanly.
      const atMs = round1(performance.now() - transition.t0Ms);
      transition.frames.holdReassertedAtMs = atMs;
      transition.tripwires.push({
        kind: "hold-reassert",
        atMs,
        detail:
          "an animation hold was re-asserted after this transition had already released it — the " +
          "motion pauses here while every timing metric stays clean"
      });
    }
    if (
      (value === "false" || value === null) &&
      mutation.oldValue !== null &&
      HOLD_KINDS.has(mutation.oldValue) &&
      transition.holdReleasedAtMs === null &&
      !holdActive(transition.elements)
    ) {
      // The LAST hold released: from here the motion is visible.
      transition.holdReleasedAtMs = round1(performance.now() - transition.t0Ms);
    }
  };

  const evaluate = () => {
    const transitional = transitionalScreens();
    if (stuckElements.length > 0) {
      // A watchdog-finalized queue stays suppressed until its screens
      // actually leave the transitional statuses; only then can a fresh
      // navigation arm a new transition.
      if (transitional.some((element) => stuckElements.includes(element))) return;
      stuckElements = [];
    }
    if (!current && transitional.length > 0) {
      beginTransition(transitional);
      return;
    }
    if (current && transitional.length === 0) {
      finalizeTransition(performance.now(), []);
      return;
    }
    if (current) {
      // A screen can join mid-transition (e.g. the entering screen mounts a
      // beat after the covered one flips) — union it into the participants.
      for (const element of transitional) {
        if (!current.elements.includes(element)) {
          current.elements.push(element);
          // A whole screen can mount after the transition opened. Its childList
          // record was processed before this screen belonged to the transition,
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
          // Not `else if (childList)`: the observer below registers exactly
          // `attributes` and `childList`, so a record that is not the first is
          // the second, and testing for it again is a branch nothing can take.
        } else {
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
    // Catch a transition already in progress at wiring time.
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
      // a moment when no transition can be running.
      if (persist && current === null) saveTrace(transitions, REPORT_SCHEMA_VERSION);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // Rule 1 of persistence.ts: never write during a transition. The timer simply
  // skips those ticks, so the trace lags a running navigation by one interval
  // and costs nothing on the frames that matter.
  const persistTick = () => {
    persistTimer = 0;
    /* v8 ignore next -- unreachable: detach() clears this timer, and a
       cleared timeout does not run. The guard is a belt on the braces. */
    if (detached) return;
    // No `persist &&` here: the timer is only armed when persistence is on, so
    // testing it again inside the tick is a branch nothing can take.
    if (current === null) saveTrace(transitions, REPORT_SCHEMA_VERSION);
    persistTimer = window.setTimeout(persistTick, PERSIST_INTERVAL_MS);
  };
  if (persist) persistTimer = window.setTimeout(persistTick, PERSIST_INTERVAL_MS);

  // Split the transition's long tasks on the hold-release boundary: a task fully
  // inside the hold was absorbed by design (the screen is posed, not
  // moving); a task straddling or past the release impinges on visible
  // motion. A hold that never released (releasedAtMs null with a hold kind)
  // makes the whole transition the held phase.
  const correlateLongTasks = (
    record: TransitionRecord
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

  /** Long tasks that ran while NO transition was open — the machine's own load. */
  const idleLongTasks = (records: readonly TransitionRecord[]): LongTaskSpan[] =>
    longTasks.filter(
      (task) =>
        task.startMs >= attachedAt &&
        !records.some(
          (record) => task.startMs + task.durationMs >= record.t0.ms && task.startMs <= record.t1.ms
        )
    );

  const withDerived = (record: TransitionRecord): TransitionRecord => {
    const tasks = correlateLongTasks(record);
    const derived: TransitionRecord = {
      ...record,
      longTasks: tasks.released,
      holdLongTasks: tasks.held,
      // Copy, don't alias: the +2rAF audits mutate the stored record after
      // finalization, and a report is documented as a point-in-time snapshot —
      // an aliased `endAudit` would change value in the caller's hands (with
      // anomalies still pre-audit).
      endAudit: {
        residualInlineTransforms: [...record.endAudit.residualInlineTransforms],
        offViewportAtRest: record.endAudit.offViewportAtRest,
        stuckStatuses: [...record.endAudit.stuckStatuses],
        orphanedHolds: [...record.endAudit.orphanedHolds]
      },
      morphs: { ...record.morphs },
      tripwires: [...record.tripwires]
    };
    derived.anomalies = deriveTransitionAnomalies({
      t0Ms: derived.t0.ms,
      t1Ms: derived.t1.ms,
      driver: derived.driver,
      frameSamples: derived.frameSamples,
      longTasks: derived.longTasks,
      holdLongTasks: derived.holdLongTasks,
      releasedAtMs: derived.holds.releasedAtMs,
      endAudit: derived.endAudit,
      motion: derived.motion,
      images: derived.images,
      morphs: derived.morphs,
      tripwires: derived.tripwires
    });
    return derived;
  };

  const materializeTransitions = (): TransitionRecord[] => {
    const closed = transitions.map(withDerived);
    const transition = current;
    if (!transition) return closed;
    // Provisional record for a still-open transition so report() never hides an
    // in-progress (or stuck) navigation.
    const now = performance.now();
    const stuck = now - transition.t0Ms > STUCK_STATUS_MS;
    return [
      ...closed,
      withDerived(buildRecord(transition, now, stuck ? currentStuckStatuses(transition) : [], true))
    ];
  };

  const sessionInput = (records: readonly TransitionRecord[]): InputEvidence => {
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
    const transitionRecords = materializeTransitions();
    const openTransition = current;
    const preconditions: Precondition[] = derivePreconditions({
      environment,
      idleLongTasks: idleLongTasks(transitionRecords),
      observedMs: performance.now() - attachedAt,
      wentHidden,
      documentHidden: document.visibilityState === "hidden",
      input: sessionInput(transitionRecords)
    });
    return {
      generatedAt: new Date().toISOString(),
      version: REPORT_SCHEMA_VERSION,
      verdict: deriveVerdict({
        preconditions,
        transitions: transitionRecords,
        observation: environment.observation
      }),
      environment,
      preconditions,
      overrides: { active: merged, warnings },
      transitions: transitionRecords,
      comparison: summariseBuckets(transitionRecords),
      previousSession,
      anomalies: deriveReportAnomalies({
        emulationSuspected: environment.emulationSuspected,
        platform: environment.platform,
        stuckTransitionOpen:
          openTransition !== null && performance.now() - openTransition.t0Ms > STUCK_STATUS_MS,
        transitionAnomalies: transitionRecords.map((record) => record.anomalies)
      }),
      blindSpots: [...BLIND_SPOTS],
      judgingProtocol: [...JUDGING_PROTOCOL]
    };
  };

  const mark = (next: string | null): string | null => {
    bucket = next === null || next === "" ? null : next;
    // A transition already in the air keeps the label it opened under: half a
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

  const handle: TransitionRecorderHandle = { detach, report, mark };

  if (installGlobal) {
    const slot = window as unknown as { flemo?: { __flemoDevtools?: boolean } };
    const occupant = slot.flemo;
    if (occupant === undefined || occupant?.__flemoDevtools === true) {
      const globalApi: FlemoGlobal = {
        __flemoDevtools: true,
        report,
        transitions: materializeTransitions,
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
