export { attachFlightRecorder, REPORT_SCHEMA_VERSION } from "./recorder";
export type { FlemoGlobal } from "./recorder";

export {
  deriveFlightAnomalies,
  deriveReportAnomalies,
  LONG_GAP_MS,
  STALL_MS,
  STUCK_STATUS_MS,
  OPENING_WINDOW_LEAD_MS,
  OPENING_WINDOW_TAIL_MS,
  MID_FLIGHT_TASK_MS
} from "./anomalies";
export type { FlightAnomalyInput, ReportAnomalyInput } from "./anomalies";

export { BLIND_SPOTS } from "./blindSpots";
export { JUDGING_PROTOCOL } from "./judging";

export { summariseBuckets } from "./buckets";

export { attachDevtoolsPanel } from "./panel";
export type { DevtoolsPanelHandle, DevtoolsPanelOptions } from "./panel";

export { attachDevtoolsHud } from "./hud";
export type { DevtoolsHudHandle, DevtoolsHudOptions } from "./hud";

export {
  captureEnvironment,
  detectEngine,
  developmentHints,
  isEmulationSuspected,
  sampleRafCadence
} from "./environment";

export { derivePreconditions } from "./preconditions";
export type { PreconditionInput } from "./preconditions";

export { deriveVerdict } from "./verdict";
export type { VerdictInput } from "./verdict";

export { clearTrace, loadTrace, saveTrace, TRACE_KEY } from "./persistence";

export {
  CORE_FLAGS,
  deriveOverrideWarnings,
  DEVTOOLS_OWNED_FLAGS,
  FLAG_REGISTRY,
  PANEL_HEIGHT_KEY,
  RETIRED_FLAGS,
  RETIRED_MARKER,
  snapshotOverrides
} from "./overrides";
export type { FlagClass, FlagDescriptor, RetiredFlag } from "./overrides";

export {
  classifyDriver,
  computeFrameStats,
  computePhaseStats,
  kindFromStatus,
  parseTranslateX
} from "./sampling";
export type { DriverEvidence } from "./frameProbe";

export type {
  BucketSummary,
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
  ImageActivity,
  InputEvidence,
  LandingAudit,
  LongTaskSpan,
  MorphActivity,
  MotionProgress,
  ObservationCapabilities,
  OverridesSection,
  Precondition,
  PreconditionStatus,
  PreviousSession,
  TripwireHit,
  UaBrand
} from "./types";
