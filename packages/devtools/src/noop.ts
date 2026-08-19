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

// Deliberately NOT a plausible-looking report. A fabricated environment
// fingerprint would be worse than no data — an agent reading a driver verdict
// off an inert report would draw a conclusion from a value nobody measured.
// Every evidence-bearing field is empty, the version says so, and the
// anomalies list says so in words. The cast is the price of refusing to
// invent the sections that carry measurements.
const inertReport = (): FlemoReport =>
  ({
    generatedAt: new Date().toISOString(),
    version: "inert",
    flights: [],
    anomalies: [INERT_NOTE],
    blindSpots: [],
    judgingProtocol: [INERT_NOTE]
  }) as unknown as FlemoReport;

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
