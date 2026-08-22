export { attachFlightRecorder, REPORT_SCHEMA_VERSION } from "./recorder";
export type { FlemoGlobal } from "./recorder";

export {
  deriveFlightAnomalies,
  deriveReportAnomalies,
  LONG_GAP_MS,
  STUCK_STATUS_MS,
  OPENING_WINDOW_LEAD_MS,
  OPENING_WINDOW_TAIL_MS,
  MID_FLIGHT_TASK_MS
} from "./anomalies";
export type { FlightAnomalyInput, ReportAnomalyInput } from "./anomalies";

export { BLIND_SPOTS } from "./blindSpots";

export { attachDevtoolsPanel } from "./panel";
export type { DevtoolsPanelHandle, DevtoolsPanelOptions } from "./panel";

export {
  captureEnvironment,
  detectEngine,
  isEmulationSuspected,
  sampleRafCadence
} from "./environment";

export {
  deriveOverrideWarnings,
  FLAG_REGISTRY,
  RETIRED_FLAGS,
  RETIRED_MARKER,
  snapshotOverrides
} from "./overrides";
export type { FlagClass, FlagDescriptor } from "./overrides";

export {
  classifyDriver,
  computeFrameStats,
  computePhaseStats,
  computePlayerGapStats,
  kindFromStatus,
  parseTranslateX
} from "./sampling";
export type { DriverEvidence } from "./sampling";

export type {
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
