import type { EnvironmentFingerprint, InputEvidence, LongTaskSpan, Precondition } from "./types";

// THE OBSERVABLE HALF OF THE JUDGING PROTOCOL.
//
// `judging.ts` states the preconditions a motion verdict is only valid under.
// Several of them the page CAN check, and every one of those has already cost
// this project a campaign: a whole day's "regression ladder" that turned out to
// be measuring a development build, a week of "residual stutter" measured
// against a 30Hz Low Power Mode ceiling, a judgement taken while another
// process on the machine held the CPU, and a build whose touch path was broken
// outright passing every layer green because every probe drove it with a mouse.
//
// So they are checked, named, and put ABOVE the data. `unknown` is a real
// answer and is used honestly: the traps that cannot be seen from inside a page
// stay `unknown` forever rather than being guessed at, because a guessed "ok"
// is worse than no check at all.

/** Under this idle frame interval the display is running above 60Hz. */
const HIGH_REFRESH_MS = 12;
/** Over this idle frame interval the page is not being served 60Hz frames. */
const HALF_RATE_MS = 20;
/** Over this, frames are arriving at a rate no transition can be judged on. */
const STARVED_MS = 40;
/** Idle long-task load over this makes the machine's own state the variable. */
const CONTENTION_TOTAL_MS = 500;
const CONTENTION_SINGLE_MS = 200;

export interface PreconditionInput {
  environment: EnvironmentFingerprint;
  /** Long tasks observed while NO flight was open. */
  idleLongTasks: LongTaskSpan[];
  /** How long the recorder has been attached. */
  observedMs: number;
  /** The document was hidden at least once while recording. */
  wentHidden: boolean;
  documentHidden: boolean;
  /** Input observed across every recorded flight. */
  input: InputEvidence;
}

const cadenceCheck = (environment: EnvironmentFingerprint): Precondition => {
  const median = environment.rafCadence.medianGapMs;
  if (median === null) {
    return {
      id: "display-cadence",
      status: "unknown",
      detail: "the idle frame cadence could not be sampled, so the display's rate is unknown"
    };
  }
  const metrics = { medianIdleFrameMs: median };
  if (median < HIGH_REFRESH_MS) {
    return {
      id: "display-cadence",
      status: "ok",
      detail: `idle frames arrive every ${median}ms — a display above 60Hz. Frame budgets in this report are still quoted against 60Hz (a gap of 30ms or more)`,
      metrics
    };
  }
  if (median <= HALF_RATE_MS) {
    return {
      id: "display-cadence",
      status: "ok",
      detail: `idle frames arrive every ${median}ms — a 60Hz clock`,
      metrics
    };
  }
  if (median <= STARVED_MS) {
    return {
      id: "display-cadence",
      status: "violated",
      detail:
        `idle frames arrive every ${median}ms — the page is being served roughly HALF rate. ` +
        "On iOS this is Low Power Mode, whose main-thread ceiling is ~30Hz while the compositor " +
        "keeps 60: motion judged here is judged against a clock no transition can beat, and the " +
        "ceiling is not a library defect. Turn it off, or judge elsewhere",
      metrics
    };
  }
  return {
    id: "display-cadence",
    status: "violated",
    detail:
      `idle frames arrive every ${median}ms — the page is barely being served frames at all ` +
      "while idle. Something outside the transition owns this machine; no motion verdict taken " +
      "here means anything",
    metrics
  };
};

const contentionCheck = (input: PreconditionInput): Precondition => {
  if (!input.environment.observation.longTasks) {
    return {
      id: "machine-idle",
      status: "unknown",
      detail:
        "this browser does not report long tasks, so the recorder cannot tell whether anything " +
        "else was competing for the main thread"
    };
  }
  const count = input.idleLongTasks.length;
  const totalMs = Math.round(input.idleLongTasks.reduce((sum, task) => sum + task.durationMs, 0));
  const maxMs = Math.round(
    input.idleLongTasks.reduce((worst, task) => Math.max(worst, task.durationMs), 0)
  );
  const metrics = { idleLongTasks: count, idleLongTaskMs: totalMs, worstIdleTaskMs: maxMs };
  if (totalMs >= CONTENTION_TOTAL_MS || maxMs >= CONTENTION_SINGLE_MS) {
    return {
      id: "machine-idle",
      status: "violated",
      detail:
        `${count} long task(s) totalling ${totalMs}ms ran while NO navigation was in flight ` +
        `(worst ${maxMs}ms). Something else on this page or this machine was busy, and a ` +
        "motion verdict taken under someone else's load measures the load. A whole tremble " +
        "campaign was invalidated by exactly this, with a build running in another window",
      metrics
    };
  }
  return {
    id: "machine-idle",
    status: "ok",
    detail: `${count} idle long task(s), ${totalMs}ms total — the page was quiet between navigations`,
    metrics
  };
};

const inputCheck = (input: PreconditionInput): Precondition => {
  const { trusted, synthetic, pointerTypes } = input.input;
  if (synthetic > 0) {
    return {
      id: "real-input",
      status: "violated",
      detail:
        `${synthetic} script-dispatched (untrusted) input event(s) drove this session. Synthetic ` +
        "dispatch never fires the gesture machinery a real navigation goes through, so a clean " +
        "run proves nothing about a finger",
      metrics: { trusted, synthetic }
    };
  }
  if (trusted === 0) {
    return {
      id: "real-input",
      status: "unknown",
      detail:
        "no input event preceded any recorded flight. These navigations were driven " +
        "programmatically or by the browser's own back/forward, which is a different path from " +
        "the one a user takes",
      metrics: { trusted, synthetic }
    };
  }
  return {
    id: "real-input",
    status: "ok",
    detail: `${trusted} trusted input event(s) drove this session (${pointerTypes.join(", ") || "type unreported"})`,
    metrics: { trusted, synthetic }
  };
};

const touchCheck = (input: PreconditionInput): Precondition => {
  const touched = input.input.pointerTypes.includes("touch");
  if (touched) {
    return {
      id: "touch-path",
      status: "ok",
      detail: "at least one navigation was driven by touch"
    };
  }
  if (input.environment.maxTouchPoints === 0) {
    return {
      id: "touch-path",
      status: "unknown",
      detail: "this device reports no touch points, so there is no touch path to exercise here"
    };
  }
  return {
    id: "touch-path",
    status: "unknown",
    detail:
      "no touch-driven navigation was recorded on a touch-capable device. The swipe and " +
      "pointer-capture paths are only reached by a finger; a build that had broken them " +
      "outright once passed every automated layer green because every probe used a mouse"
  };
};

const UNOBSERVABLE: readonly Precondition[] = [
  {
    id: "devtools-closed",
    status: "unknown",
    detail:
      "whether an inspector is open cannot be seen from inside the page. An open one serializes " +
      "requests and repaints its own panels on the same machine; a whole campaign's residual " +
      "stutter was this and nothing else. Confirm it with the user"
  },
  {
    id: "no-screen-capture",
    status: "unknown",
    detail:
      "whether the screen is being captured cannot be seen from inside the page. A capture " +
      "client forces the compositor to present every vsync, which SUPPRESSES the symptom — a " +
      "recording that looks smooth proves nothing about the uncaptured session"
  },
  {
    id: "viewing-configuration",
    status: "unknown",
    detail:
      "which physical display this window is on, its refresh rate and scaling, cannot be read " +
      "from the page. Establish it with the user before believing any verdict"
  }
];

export const derivePreconditions = (input: PreconditionInput): Precondition[] => {
  const { environment } = input;
  const checks: Precondition[] = [];

  checks.push(
    environment.emulationSuspected
      ? {
          id: "device-emulation",
          status: "violated",
          detail:
            "DevTools device emulation is suspected (Blink on a desktop platform reporting touch " +
            "points). Emulation composites the page to a rescaled surface: every in-page " +
            "instrument reads the pre-scale surface and reports clean while the eye watches the " +
            "post-scale one" +
            (/Win/i.test(environment.platform)
              ? ". Windows touch hardware makes this signal ambiguous — confirm the device toolbar state"
              : "")
        }
      : {
          id: "device-emulation",
          status: "ok",
          detail: "no device-emulation signature on this session"
        }
  );

  checks.push(cadenceCheck(environment));

  checks.push(
    input.documentHidden || input.wentHidden
      ? {
          id: "page-foreground",
          status: "violated",
          detail: input.documentHidden
            ? "this document is HIDDEN right now — a backgrounded page is throttled to a fraction of its frames"
            : "this document was hidden at least once while recording; any flight that ran then was throttled"
        }
      : { id: "page-foreground", status: "ok", detail: "the document stayed visible throughout" }
  );

  checks.push(contentionCheck(input));

  checks.push(
    environment.developmentHints.length > 0
      ? {
          id: "build-mode",
          status: "violated",
          detail:
            `development-server globals are present (${environment.developmentHints.join(", ")}). ` +
            "A development build is a different program: unminified, double-invoking, and " +
            "hot-reload instrumented. A day of ladder measurements once turned out to be " +
            "measuring the build itself"
        }
      : {
          id: "build-mode",
          status: "unknown",
          detail:
            "no development-server global was found. That is consistent with a production build " +
            "but does not prove one — confirm how this page was built"
        }
  );

  checks.push(inputCheck(input));
  checks.push(touchCheck(input));

  checks.push(
    environment.reducedMotion
      ? {
          id: "reduced-motion",
          status: "violated",
          detail:
            "this session prefers reduced motion, so the transitions under test are being " +
            "suppressed or shortened. Whatever is on screen is not the motion being judged"
        }
      : { id: "reduced-motion", status: "ok", detail: "reduced motion is not requested" }
  );

  return [...checks, ...UNOBSERVABLE];
};
