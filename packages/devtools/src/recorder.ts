import { deriveFlightAnomalies, deriveReportAnomalies, STUCK_STATUS_MS } from "./anomalies";
import { BLIND_SPOTS } from "./blindSpots";
import { captureEnvironment, sampleRafCadence } from "./environment";
import { JUDGING_PROTOCOL } from "./judging";
import { deriveOverrideWarnings, LEGACY_LOCAL_PIN_KEY, snapshotOverrides } from "./overrides";
import {
  classifyDriver,
  computeFrameStats,
  computePlayerGapStats,
  kindFromStatus,
  parseTranslateX
} from "./sampling";

import type { DriverEvidence } from "./sampling";
import type {
  FlemoReport,
  ImageActivity,
  FlightKind,
  FlightRecord,
  FlightRecorderHandle,
  FlightRecorderOptions,
  LongTaskSpan
} from "./types";

// The flight recorder: a PURE CONSUMER of surfaces flemo already exposes —
// data-flemo-* attributes, window.__flemoPlayerGaps, the flemo:* storage
// registry, and standard observers (MutationObserver, PerformanceObserver,
// rAF). It imports nothing from @flemo/core or @flemo/react and changes no
// behavior; attaching it must never alter the motion it measures.

export const REPORT_SCHEMA_VERSION = "2";

const TRANSITIONAL = new Set(["PUSHING", "POPPING", "REPLACING"]);
const HOLD_KINDS = new Set(["true", "park", "park-under", "park-over"]);
const SCREEN_SELECTOR = "[data-flemo-screen]";
const STATUS_ATTR = "data-flemo-status";
const ACTIVE_ATTR = "data-flemo-active";
const HOLD_ATTR = "data-flemo-anim-hold";
/** How many rAF frames past flight end the landing audit waits (the engine's
 *  own COMPLETED cleanup and the deferred freeze land in those commits). */
const LANDING_AUDIT_FRAMES = 2;
const MAX_FRAME_GAPS = 2000;
/** The engine's hold markers, checked for orphans at rest (core owns these). */
const IMAGE_HOLD_ATTR = "data-flemo-img-hold";
const HELD_ARRIVAL_ATTR = "data-flemo-held-arrival";
/**
 * A released frame counts as stalled only once the flight has moved at least
 * once — the first released frame has nothing to compare against, and a
 * compiled animation's clock legitimately reads 0 on it.
 */
const STALL_MIN_FRAMES = 2;
/**
 * Ceiling on tracked images per flight. A list commit can append hundreds at
 * once, and the recorder must never become the cost it is measuring — past
 * this point the sample is already conclusive either way.
 */
const MAX_TRACKED_IMAGES = 200;
const MAX_LONG_TASKS = 1000;

const round1 = (value: number) => Math.round(value * 10) / 10;

interface ActiveFlight {
  id: string;
  kind: FlightKind;
  routerId?: string;
  t0Ms: number;
  t0Iso: string;
  elements: Element[];
  participants: FlightRecord["participants"];
  holdKind: string | null;
  holdReleasedAtMs: number | null;
  playerGapStartIndex: number;
  /** Frame gaps while any participant still carried an active anim-hold. */
  heldGaps: number[];
  /** Frame gaps after every hold released (the visible-motion phase). */
  releasedGaps: number[];
  lastFrameAt: number | null;
  evidence: DriverEvidence;
  lastPose: Map<Element, string>;
  /** Cached compiled animations, so the clock read never re-queries per frame. */
  clocks: Map<Element, Animation>;
  lastClock: Map<Element, number>;
  releasedFrames: number;
  stalledFrames: number;
  tailFrames: number;
  stallRunMs: number;
  longestStallMs: number;
  pausedAfterRelease: boolean;
  holdReassertedAtMs: number | null;
  /** Images being tracked for this flight: loading at t0, plus mid-flight arrivals. */
  imagesTracked: Set<HTMLImageElement>;
  imagesLoadingAtStart: number;
  imagesAddedDuringFlight: number;
  imagesHeld: Set<Element>;
  rafId: number | null;
}

/** The API installed at window.flemo (guarded — see attachFlightRecorder). */
export interface FlemoGlobal {
  /** Marker distinguishing this recorder's global from foreign occupants. */
  __flemoDevtools: true;
  report: () => FlemoReport;
  flights: () => FlightRecord[];
  detach: () => void;
}

let activeHandle: FlightRecorderHandle | null = null;

const windowSlot = (): { flemo?: unknown; __flemoPlayerGaps?: number[] } =>
  window as unknown as { flemo?: unknown; __flemoPlayerGaps?: number[] };

/**
 * Attach the flight recorder. Idempotent: while a recorder is attached,
 * further calls return the SAME handle (their options are ignored). In a
 * non-DOM environment it returns an inert handle whose report carries only
 * the schema constants.
 */
export const attachFlightRecorder = (options: FlightRecorderOptions = {}): FlightRecorderHandle => {
  if (activeHandle) return activeHandle;
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      detach: () => {},
      report: () => ({
        generatedAt: new Date().toISOString(),
        version: REPORT_SCHEMA_VERSION,
        environment: captureEnvironment({ medianGapMs: null, sampleCount: 0 }),
        overrides: { active: {}, warnings: ["no DOM available — recorder ran inert"] },
        driverPolicy: { demotion: null, forcePin: null },
        flights: [],
        anomalies: [],
        blindSpots: [...BLIND_SPOTS],
        judgingProtocol: [...JUDGING_PROTOCOL]
      })
    };
  }

  const maxFlights = options.maxFlights ?? 50;
  const log = options.log ?? false;
  const installGlobal = options.installGlobal ?? true;

  // Overrides are snapshotted at ATTACH as well as at report: the library
  // strips malformed/expired force pins on its first driver decision, so a
  // residue key can vanish before report() runs — exactly the kind of
  // invisible state a session report exists to preserve.
  const attachOverrides = snapshotOverrides();
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
  // Screens a stuck-watchdog finalization locked out of re-arming (see
  // evaluate) — cleared once they leave the transitional statuses.
  let stuckElements: Element[] = [];
  let detached = false;
  let installedGlobal = false;

  const transitionalScreens = (): Element[] =>
    Array.from(document.querySelectorAll(SCREEN_SELECTOR)).filter((element) =>
      TRANSITIONAL.has(element.getAttribute(STATUS_ATTR) ?? "")
    );

  const countParticipants = (screens: Element[]): FlightRecord["participants"] => {
    const bars = Array.from(document.querySelectorAll("[data-flemo-bar]")).filter(
      (element) =>
        TRANSITIONAL.has(element.getAttribute("data-flemo-bar-status") ?? "") ||
        element.getAttribute("data-flemo-bar-riding") === "true"
    ).length;
    const decorators = Array.from(document.querySelectorAll("[data-flemo-decorator]")).filter(
      (element) => TRANSITIONAL.has(element.getAttribute(STATUS_ATTR) ?? "")
    ).length;
    const parts = Array.from(document.querySelectorAll("[data-flemo-part-name]")).filter(
      (element) => TRANSITIONAL.has(element.getAttribute(STATUS_ATTR) ?? "")
    ).length;
    return { screens: screens.length, bars, decorators, parts };
  };

  /** Every <img> inside the flight's participating screens. */
  const participantImages = (screens: Element[]): HTMLImageElement[] => {
    const images: HTMLImageElement[] = [];
    for (const screen of screens) {
      for (const img of Array.from(screen.querySelectorAll("img"))) images.push(img);
    }
    return images;
  };

  /**
   * Per-image accounting. Counting completions and holds separately and
   * subtracting would cancel a held-but-still-loading image against an
   * unheld completed one, hiding the exact regression this exists to catch.
   */
  const imageActivity = (flight: ActiveFlight): ImageActivity => {
    let completed = 0;
    let completedUnheld = 0;
    for (const img of flight.imagesTracked) {
      if (!img.complete) continue;
      completed += 1;
      if (!flight.imagesHeld.has(img)) completedUnheld += 1;
    }
    return {
      loadingAtStart: flight.imagesLoadingAtStart,
      addedDuringFlight: flight.imagesAddedDuringFlight,
      completedDuringFlight: completed,
      heldDuringFlight: flight.imagesHeld.size,
      completedUnheld
    };
  };

  /**
   * Images that arrive DURING the flight — a data commit landing mid-
   * navigation, which is the case core's image hold watches for with its own
   * observer. Without this the recorder would only ever see the screens as
   * they looked at t0.
   */
  const trackAddedImages = (added: NodeList): void => {
    const flight = current;
    if (!flight || flight.imagesTracked.size >= MAX_TRACKED_IMAGES) return;
    for (const node of Array.from(added)) {
      if (!(node instanceof Element)) continue;
      // Only inside this flight's participants: a mutation elsewhere on the
      // page is not on the moving layer.
      if (!flight.elements.some((screen) => screen === node || screen.contains(node))) continue;
      const images =
        node instanceof HTMLImageElement ? [node] : Array.from(node.querySelectorAll("img"));
      for (const img of images) {
        if (img.complete || flight.imagesTracked.has(img)) continue;
        if (flight.imagesTracked.size >= MAX_TRACKED_IMAGES) return;
        flight.imagesTracked.add(img);
        flight.imagesAddedDuringFlight += 1;
      }
    }
  };

  /** One query per flight, on the first moving frame: which images the engine parked. */
  const snapshotHeldImages = (flight: ActiveFlight) => {
    for (const screen of flight.elements) {
      for (const held of Array.from(screen.querySelectorAll(`img[${IMAGE_HOLD_ATTR}]`))) {
        flight.imagesHeld.add(held);
      }
    }
    // A mid-flight arrival can be parked after that sweep, so re-check the
    // tracked set directly rather than relying on one query.
    for (const img of flight.imagesTracked) {
      if (img.hasAttribute(IMAGE_HOLD_ATTR)) flight.imagesHeld.add(img);
    }
  };

  /**
   * Did this frame MOVE? Read from the cheapest honest source per tier: a
   * compiled flight's own animation clock (getAnimations, no style flush) and
   * a player flight's inline pose (already in the style attribute). A frame
   * where neither moved is a stall — the signature that timing metrics miss
   * (see MotionProgress).
   */
  const sampleProgress = (flight: ActiveFlight, frameGapMs: number) => {
    flight.releasedFrames += 1;
    let advanced = false;
    // A frame after the last animation has FINISHED is not a stall: the motion
    // is over and the pose is meant to be still. Only the flight's own closing
    // latency is left, which is a different measurement (see tailFrames).
    let anyRunningClock = false;
    for (const element of flight.elements) {
      const clock = flight.clocks.get(element);
      if (clock) {
        if (clock.playState === "paused") flight.pausedAfterRelease = true;
        if (clock.playState !== "finished") anyRunningClock = true;
        const time = typeof clock.currentTime === "number" ? clock.currentTime : null;
        if (time !== null) {
          const previous = flight.lastClock.get(element);
          if (previous !== undefined && time !== previous) advanced = true;
          flight.lastClock.set(element, time);
        }
      }
      const style = (element as HTMLElement).style;
      if (style && style.animation !== "") {
        const pose = `${style.transform}/${style.opacity}`;
        if (flight.lastPose.get(element) !== pose) advanced = true;
      }
    }
    // Nothing to compare against on the first released frame.
    if (flight.releasedFrames < STALL_MIN_FRAMES) return;
    if (advanced) {
      flight.stallRunMs = 0;
      return;
    }
    if (!anyRunningClock && flight.clocks.size > 0) {
      flight.tailFrames += 1;
      flight.stallRunMs = 0;
      return;
    }
    flight.stalledFrames += 1;
    flight.stallRunMs += frameGapMs;
    if (flight.stallRunMs > flight.longestStallMs) flight.longestStallMs = flight.stallRunMs;
  };

  const sampleDriverEvidence = (flight: ActiveFlight) => {
    for (const element of flight.elements) {
      const style = (element as HTMLElement).style;
      const getAnimations = (element as Element & { getAnimations?: () => Animation[] })
        .getAnimations;
      const cached = flight.clocks.get(element);
      // getAnimations() allocates an array per call; once this element's
      // compiled animation is in hand, re-reading it every frame is pure
      // overhead on the very thread the flight is competing for.
      if (cached !== undefined && cached.playState !== "finished") {
        // The cached animation still counts as evidence: it is usually
        // CACHED WHILE PAUSED (the hold poses the screen before releasing
        // it), so skipping this would classify a perfectly normal compiled
        // flight as "unknown" the moment it starts running.
        if (cached.playState === "running") flight.evidence.compiledAnimation = true;
        if (style && style.animation !== "") {
          flight.evidence.playerSuppression = true;
          const pose = `${style.transform}/${style.opacity}`;
          const previous = flight.lastPose.get(element);
          if (previous !== undefined && previous !== pose) flight.evidence.playerAdvance = true;
          flight.lastPose.set(element, pose);
        }
        continue;
      }
      if (typeof getAnimations === "function") {
        try {
          for (const animation of getAnimations.call(element)) {
            const name = (animation as { animationName?: string }).animationName;
            if (typeof name === "string" && name.startsWith("flemo-")) {
              // Cached for the per-frame clock read; re-queried only while the
              // element has no live animation yet.
              flight.clocks.set(element, animation);
              if (animation.playState === "running") flight.evidence.compiledAnimation = true;
            }
          }
        } catch {
          // getAnimations can throw on detached nodes in some engines.
        }
      }
      if (style && style.animation !== "") {
        flight.evidence.playerSuppression = true;
        const pose = `${style.transform}/${style.opacity}`;
        const previous = flight.lastPose.get(element);
        if (previous !== undefined && previous !== pose) flight.evidence.playerAdvance = true;
        flight.lastPose.set(element, pose);
      }
    }
  };

  // A hold is active while ANY participating screen still carries an active
  // data-flemo-anim-hold value; the flight is "released" once every one of
  // them reads "false" (or drops the attribute). The engine deliberately
  // absorbs heavy commits INTO the hold — the screen is posed, not moving —
  // so gaps and long tasks are segmented on this boundary.
  const holdActive = (flight: ActiveFlight): boolean =>
    flight.elements.some((element) => {
      const value = element.getAttribute(HOLD_ATTR);
      return value !== null && HOLD_KINDS.has(value);
    });

  const sampleFrame = () => {
    const flight = current;
    if (!flight || detached) return;
    const now = performance.now();
    if (
      flight.lastFrameAt !== null &&
      flight.heldGaps.length + flight.releasedGaps.length < MAX_FRAME_GAPS
    ) {
      const gapMs = now - flight.lastFrameAt;
      const held = holdActive(flight);
      (held ? flight.heldGaps : flight.releasedGaps).push(gapMs);
      // Progress is only meaningful once the screen is actually moving, and
      // must read the PREVIOUS frame's pose — so it runs before the evidence
      // pass overwrites it.
      if (!held) {
        sampleProgress(flight, gapMs);
        if (flight.releasedFrames === 1) snapshotHeldImages(flight);
      }
    }
    flight.lastFrameAt = now;
    sampleDriverEvidence(flight);
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

  const currentStuckStatuses = (flight: ActiveFlight): string[] => {
    const statuses = new Set<string>();
    for (const element of flight.elements) {
      const status = element.getAttribute(STATUS_ATTR) ?? "";
      if (TRANSITIONAL.has(status)) statuses.add(status);
    }
    return [...statuses];
  };

  const beginFlight = (screens: Element[]) => {
    const now = performance.now();
    flightSeq += 1;
    const activeFirst =
      screens.find((element) => element.getAttribute(ACTIVE_ATTR) === "true") ?? screens[0];
    const kind = kindFromStatus(activeFirst.getAttribute(STATUS_ATTR) ?? "") ?? "PUSH";
    let holdKind: string | null = null;
    for (const element of screens) {
      const hold = element.getAttribute(HOLD_ATTR);
      if (hold !== null && HOLD_KINDS.has(hold)) {
        holdKind = hold;
        break;
      }
    }
    current = {
      id: `flight-${flightSeq}`,
      kind,
      routerId: activeFirst.getAttribute("data-flemo-router") ?? undefined,
      t0Ms: now,
      t0Iso: new Date().toISOString(),
      elements: [...screens],
      participants: countParticipants(screens),
      holdKind,
      holdReleasedAtMs: null,
      playerGapStartIndex: windowSlot().__flemoPlayerGaps?.length ?? 0,
      heldGaps: [],
      releasedGaps: [],
      lastFrameAt: null,
      evidence: { compiledAnimation: false, playerSuppression: false, playerAdvance: false },
      lastPose: new Map(),
      clocks: new Map(),
      lastClock: new Map(),
      releasedFrames: 0,
      tailFrames: 0,
      stalledFrames: 0,
      stallRunMs: 0,
      longestStallMs: 0,
      pausedAfterRelease: false,
      holdReassertedAtMs: null,
      imagesTracked: new Set(participantImages(screens).filter((img) => !img.complete)),
      imagesLoadingAtStart: 0,
      imagesAddedDuringFlight: 0,
      imagesHeld: new Set(),
      rafId: null
    };
    current.imagesLoadingAtStart = current.imagesTracked.size;
    sampleDriverEvidence(current);
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
      auditLanding(record, elements);
    };
    requestAnimationFrame(step);
  };

  /**
   * Hold markers still on the page at rest. Both of these are supposed to be
   * gone by the landing: whatever they hide has no owner left to reveal it.
   * Scanned document-wide on purpose — an orphan's screen is often exactly
   * the one that was swapped out from under the hold.
   *
   * Skipped entirely when another flight is already running: the audit lands
   * two frames after the previous flight ended, and by then a fast
   * back-to-back navigation legitimately owns hold markers of its own. A
   * missed detection is recoverable; blaming a flight for its successor's
   * working holds would train the reader to ignore the signal.
   */
  const orphanedHolds = (): string[] => {
    if (current !== null || transitionalScreens().length > 0) return [];
    const found: string[] = [];
    for (const [attribute, label] of [
      [IMAGE_HOLD_ATTR, "image reveal hold"],
      [HELD_ARRIVAL_ATTR, "arrival hold"]
    ] as const) {
      // The selector is built from a constant attribute name, so it cannot
      // be invalid — no guard needed here.
      const count = document.querySelectorAll(`[${attribute}]`).length;
      if (count > 0) found.push(`${count} × ${label} (${attribute}) still marked at rest`);
    }
    return found;
  };

  const auditLanding = (record: FlightRecord, elements: Element[]) => {
    const residual: string[] = [];
    let offViewport = false;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth ?? 0;
    elements.forEach((element, index) => {
      if (!(element instanceof HTMLElement) || !element.isConnected) return;
      let computedTransform = "";
      let computedDisplay = "";
      try {
        const computed = getComputedStyle(element);
        computedTransform = computed.transform ?? "";
        computedDisplay = computed.display ?? "";
      } catch {
        // Detached document: nothing to audit.
      }
      // Frozen screens (display:none — the engine's covered-screen freeze)
      // own their styles and paint nothing; skip them.
      if (computedDisplay === "none") return;
      const isActive = element.getAttribute(ACTIVE_ATTR) === "true";
      const label = `screen[${index}]${isActive ? " (active)" : ""}`;
      if (element.style.transform !== "" && element.style.transform !== "none") {
        residual.push(`${label} transform=${element.style.transform}`);
      }
      if (element.style.opacity !== "" && element.style.opacity !== "1") {
        residual.push(`${label} opacity=${element.style.opacity}`);
      }
      if (isActive && element.getAttribute(STATUS_ATTR) === "COMPLETED" && viewportWidth > 0) {
        const translateX = parseTranslateX(computedTransform);
        if (translateX !== null && Math.abs(translateX) >= viewportWidth * 0.5) {
          offViewport = true;
        }
      }
    });
    record.landing.residualInlineTransforms = residual;
    record.landing.offViewportAtRest = offViewport;
    record.landing.orphanedHolds = orphanedHolds();
  };

  const finalizeFlight = (endNow: number, stuckStatuses: string[]) => {
    const flight = current;
    if (!flight) return;
    // Last sweep before the numbers are frozen: an image parked late in the
    // flight (or one that arrived mid-flight) must not read as unheld.
    snapshotHeldImages(flight);
    current = null;
    if (flight.rafId !== null) cancelAnimationFrame(flight.rafId);
    const playerGapsSlice = (windowSlot().__flemoPlayerGaps ?? []).slice(
      flight.playerGapStartIndex
    );
    const playerGaps = computePlayerGapStats(playerGapsSlice);
    const record: FlightRecord = {
      id: flight.id,
      ...(flight.routerId !== undefined ? { routerId: flight.routerId } : {}),
      kind: flight.kind,
      t0: { ms: round1(flight.t0Ms), iso: flight.t0Iso },
      t1: { ms: round1(endNow), iso: new Date().toISOString() },
      durationMs: round1(endNow - flight.t0Ms),
      driver: classifyDriver(flight.evidence),
      participants: flight.participants,
      holds: { kind: flight.holdKind, releasedAtMs: flight.holdReleasedAtMs },
      frameSamples: computeFrameStats(flight.heldGaps, flight.releasedGaps),
      motion: {
        sampledFrames: flight.releasedFrames,
        stalledFrames: flight.stalledFrames,
        longestStallMs: round1(flight.longestStallMs),
        pausedAfterRelease: flight.pausedAfterRelease,
        holdReassertedAtMs: flight.holdReassertedAtMs,
        tailFrames: flight.tailFrames
      },
      images: imageActivity(flight),
      ...(playerGaps ? { playerGaps } : {}),
      longTasks: [], // correlated lazily at report() — entries arrive async
      holdLongTasks: [],
      landing: {
        residualInlineTransforms: [],
        offViewportAtRest: false,
        stuckStatuses,
        orphanedHolds: []
      },
      anomalies: [] // derived lazily at report()
    };
    flights.push(record);
    if (flights.length > maxFlights) flights.splice(0, flights.length - maxFlights);
    if (stuckStatuses.length === 0) scheduleLandingAudit(record, flight.elements);
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
    const value = mutation.target.getAttribute(HOLD_ATTR);
    if (value !== null && HOLD_KINDS.has(value) && flight.holdKind === null) {
      flight.holdKind = value;
    }
    if (
      value !== null &&
      HOLD_KINDS.has(value) &&
      flight.holdReleasedAtMs !== null &&
      flight.holdReassertedAtMs === null
    ) {
      // A hold going back ON after the release is the 2026-08-18 race: an
      // interleaved commit writing the stale paused attribute over a running
      // flight, which pauses the animation while rAF keeps ticking cleanly.
      flight.holdReassertedAtMs = round1(performance.now() - flight.t0Ms);
    }
    if (
      (value === "false" || value === null) &&
      mutation.oldValue !== null &&
      HOLD_KINDS.has(mutation.oldValue) &&
      flight.holdReleasedAtMs === null &&
      !holdActive(flight)
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
          trackAddedImages(element.querySelectorAll("img"));
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
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === HOLD_ATTR) {
          trackHoldMutation(mutation);
        } else if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          trackAddedImages(mutation.addedNodes);
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
        attributeFilter: [STATUS_ATTR, ACTIVE_ATTR, HOLD_ATTR]
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

  const materializeFlights = (): FlightRecord[] => {
    const now = performance.now();
    const closed = flights.map((record) => {
      const tasks = correlateLongTasks(record);
      const withTasks: FlightRecord = {
        ...record,
        longTasks: tasks.released,
        holdLongTasks: tasks.held,
        // Copy, don't alias: the +2rAF landing audit mutates the stored
        // record after finalization, and a report is documented as a
        // point-in-time snapshot — an aliased `landing` would change value
        // in the caller's hands (with anomalies still pre-audit).
        landing: {
          residualInlineTransforms: [...record.landing.residualInlineTransforms],
          offViewportAtRest: record.landing.offViewportAtRest,
          stuckStatuses: [...record.landing.stuckStatuses],
          orphanedHolds: [...record.landing.orphanedHolds]
        }
      };
      withTasks.anomalies = deriveFlightAnomalies({
        t0Ms: withTasks.t0.ms,
        t1Ms: withTasks.t1.ms,
        driver: withTasks.driver,
        frameSamples: withTasks.frameSamples,
        playerGaps: withTasks.playerGaps ?? null,
        longTasks: withTasks.longTasks,
        holdLongTasks: withTasks.holdLongTasks,
        releasedAtMs: withTasks.holds.releasedAtMs,
        landing: withTasks.landing,
        motion: withTasks.motion,
        images: withTasks.images
      });
      return withTasks;
    });
    const flight = current;
    if (!flight) return closed;
    // Provisional record for a still-open flight so report() never hides an
    // in-progress (or stuck) navigation.
    const stuck = now - flight.t0Ms > STUCK_STATUS_MS;
    const provisional: FlightRecord = {
      id: `${flight.id} (in flight)`,
      ...(flight.routerId !== undefined ? { routerId: flight.routerId } : {}),
      kind: flight.kind,
      t0: { ms: round1(flight.t0Ms), iso: flight.t0Iso },
      t1: { ms: round1(now), iso: new Date().toISOString() },
      durationMs: round1(now - flight.t0Ms),
      driver: classifyDriver(flight.evidence),
      participants: flight.participants,
      holds: { kind: flight.holdKind, releasedAtMs: flight.holdReleasedAtMs },
      frameSamples: computeFrameStats(flight.heldGaps, flight.releasedGaps),
      motion: {
        sampledFrames: flight.releasedFrames,
        stalledFrames: flight.stalledFrames,
        longestStallMs: round1(flight.longestStallMs),
        pausedAfterRelease: flight.pausedAfterRelease,
        holdReassertedAtMs: flight.holdReassertedAtMs,
        tailFrames: flight.tailFrames
      },
      images: imageActivity(flight),
      longTasks: [],
      holdLongTasks: [],
      landing: {
        residualInlineTransforms: [],
        offViewportAtRest: false,
        stuckStatuses: stuck ? currentStuckStatuses(flight) : [],
        orphanedHolds: []
      },
      anomalies: []
    };
    const provisionalTasks = correlateLongTasks(provisional);
    provisional.longTasks = provisionalTasks.released;
    provisional.holdLongTasks = provisionalTasks.held;
    provisional.anomalies = deriveFlightAnomalies({
      t0Ms: provisional.t0.ms,
      t1Ms: provisional.t1.ms,
      driver: provisional.driver,
      frameSamples: provisional.frameSamples,
      playerGaps: provisional.playerGaps ?? null,
      longTasks: provisional.longTasks,
      holdLongTasks: provisional.holdLongTasks,
      releasedAtMs: provisional.holds.releasedAtMs,
      landing: provisional.landing,
      motion: provisional.motion,
      images: provisional.images
    });
    return [...closed, provisional];
  };

  const readStorageDirect = (which: "session" | "local", key: string): string | null => {
    try {
      const storage = which === "session" ? sessionStorage : localStorage;
      return storage.getItem(key);
    } catch {
      return null;
    }
  };

  const report = (): FlemoReport => {
    const nowOverrides = snapshotOverrides();
    const merged: Record<string, string> = { ...nowOverrides };
    for (const [key, value] of Object.entries(attachOverrides)) {
      if (!(key in nowOverrides)) merged[`${key} (at attach, since cleared)`] = value;
    }
    const warnings = deriveOverrideWarnings(merged);
    const environment = captureEnvironment(cadence);
    const forcePin = readStorageDirect("session", "flemo:motion-driver-force");
    const clearedForcePin =
      forcePin === null ? (attachOverrides["flemo:motion-driver-force"] ?? null) : null;
    const flightRecords = materializeFlights();
    const openFlight = current;
    return {
      generatedAt: new Date().toISOString(),
      version: REPORT_SCHEMA_VERSION,
      environment,
      overrides: { active: merged, warnings },
      driverPolicy: {
        demotion: readStorageDirect("local", "flemo:motion-driver"),
        forcePin
      },
      flights: flightRecords,
      anomalies: deriveReportAnomalies({
        forcePin,
        legacyLocalForcePin: merged[LEGACY_LOCAL_PIN_KEY] ?? null,
        clearedForcePin,
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

  const detach = () => {
    if (detached) return;
    detached = true;
    observer?.disconnect();
    if (pendingDomReady !== null) {
      document.removeEventListener("DOMContentLoaded", pendingDomReady);
      pendingDomReady = null;
    }
    longTaskObserver?.disconnect();
    if (current?.rafId != null) cancelAnimationFrame(current.rafId);
    current = null;
    if (installedGlobal) {
      const slot = windowSlot();
      const occupant = slot.flemo as { __flemoDevtools?: boolean } | undefined;
      if (occupant?.__flemoDevtools === true) delete slot.flemo;
    }
    activeHandle = null;
  };

  const handle: FlightRecorderHandle = { detach, report };

  if (installGlobal) {
    const slot = windowSlot();
    const occupant = slot.flemo as { __flemoDevtools?: boolean } | undefined;
    if (occupant === undefined || occupant?.__flemoDevtools === true) {
      const globalApi: FlemoGlobal = {
        __flemoDevtools: true,
        report,
        flights: materializeFlights,
        detach
      };
      slot.flemo = globalApi;
      installedGlobal = true;
    }
    // A foreign window.flemo is left untouched — the recorder still works
    // through the returned handle.
  }

  activeHandle = handle;
  return handle;
};
