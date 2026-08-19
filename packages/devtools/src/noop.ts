// The PRODUCTION entry point.
//
// `package.json`'s `exports` map resolves `@flemo/devtools` here whenever the
// bundler builds for production, so a consumer writes a plain top-level import
// and still ships nothing heavy: `recorder.ts` (36KB of source) and the panel
// (15KB) are never referenced from this file, so they never enter the module
// graph.
//
// Why the PACKAGE owns this instead of the consumer: the failure is SILENT. A
// normal import of a dev-time tool builds clean, warns about nothing, and
// ships to every visitor — measured on flemo.dev itself, where the recorder's
// strings turned up in a production chunk and had to be removed (PR #271).
// Anything that only works when every consumer remembers a guard will
// eventually ship without it.
//
// The pure analysis modules ARE re-exported as-is rather than stubbed. They
// import nothing but each other, they touch no DOM, and `sideEffects: false`
// lets a bundler drop whichever ones a consumer does not use. Stubbing them by
// hand would buy nothing and would rot: an export added to index.ts and
// forgotten here would break the build in production only.
//
// Consumers on a bundler that does not set the `development`/`production`
// conditions (Vite and Next do; it is not universal) still need the
// dynamic-import guard the README documents. This module is the floor, not a
// replacement for reading it.

// Type-only imports: erased at build, so naming ./panel here does NOT put the
// panel back in the production graph.
import type { DevtoolsPanelHandle, DevtoolsPanelOptions } from "./panel";
import type { FlemoReport, FlightRecorderHandle, FlightRecorderOptions } from "./types";

export * from "./anomalies";
export * from "./blindSpots";
export * from "./environment";
export * from "./overrides";
export * from "./sampling";

// Duplicated rather than re-exported from recorder.ts, which would put the
// recorder back in the graph and leave its removal to the optimizer.
// `noop.test.ts` asserts the two stay equal.
export const REPORT_SCHEMA_VERSION = "2";

const INERT_NOTE =
  "@flemo/devtools resolved to its production entry: nothing was recorded. " +
  "Run a development build to collect a real report.";

const noop = () => {};

// A COMPLETE FlemoReport, with no cast. An earlier version omitted the
// `environment` / `overrides` / `driverPolicy` sections and forced the type,
// on the reasoning that a fabricated fingerprint is worse than no data. That
// reasoning was right about fabrication and wrong about the remedy: the types
// resolve to index.d.ts under every condition, so `report().environment.engine`
// compiled fine and threw only in production — the exact class of silent,
// production-only failure this entry exists to remove.
//
// So the sections are present and every field says "nothing was measured" in
// whatever way its type allows: `unknown` where the union offers it, `null`
// where the field is nullable, zero/empty otherwise. Anything a reader might
// still mistake for a measurement (a `0` touch-point count, a `false`
// capability) is disambiguated by `version: "inert"` and by the anomalies
// entry, which says so in words.
const inertReport = (): FlemoReport => ({
  generatedAt: new Date().toISOString(),
  version: "inert",
  environment: {
    userAgent: "",
    uaBrands: null,
    engine: "unknown",
    platform: "",
    maxTouchPoints: 0,
    devicePixelRatio: 0,
    screen: { width: 0, height: 0 },
    viewport: { width: 0, height: 0 },
    visualViewportScale: null,
    rafCadence: { medianGapMs: null, sampleCount: 0 },
    reducedMotion: false,
    emulationSuspected: false,
    observation: { longTasks: false, elementAnimations: false, playerGapMirror: false }
  },
  overrides: { active: {}, warnings: [INERT_NOTE] },
  driverPolicy: { demotion: null, forcePin: null },
  flights: [],
  anomalies: [INERT_NOTE],
  blindSpots: [],
  judgingProtocol: [INERT_NOTE]
});

export const attachFlightRecorder = (_options?: FlightRecorderOptions): FlightRecorderHandle => ({
  detach: noop,
  report: inertReport
});

export const attachDevtoolsPanel = (_options?: DevtoolsPanelOptions): DevtoolsPanelHandle => ({
  detach: noop
});

export type { FlemoGlobal } from "./recorder";
export type { DevtoolsPanelHandle, DevtoolsPanelOptions } from "./panel";
export type {
  DriverPolicySection,
  EnvironmentFingerprint,
  FlemoReport,
  FlightDriver,
  FlightHolds,
  FlightKind,
  FlightParticipants,
  FlightRecord,
  FlightRecorderHandle,
  FlightRecorderOptions,
  FlightTimestamp,
  FramePhaseStats,
  FrameSampleStats,
  LandingAudit,
  LongTaskSpan,
  ObservationCapabilities,
  OverridesSection,
  PlayerGapStats,
  UaBrand
} from "./types";
