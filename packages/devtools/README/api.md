# API

- `attachFlightRecorder(options?)` returns `{ report(), mark(), detach() }`; options: `maxFlights` (50), `log` (`false`), `installGlobal` (`true`), `persist` (`true`).
- `attachDevtoolsHud(options?)` returns `{ detach() }`; options: `recorder`, `position` (`"bottom-right"`), `initialExpanded` (`false`), `initialHidden`, `buckets`.
- `attachDevtoolsPanel(options?)` returns `{ detach() }`; options: `recorder`, `initialOpen` (`false`), `position` (`"bottom-right"`), `buckets`.
- Pure helpers: `deriveFlightAnomalies`, `deriveReportAnomalies`, `deriveOverrideWarnings`, `derivePreconditions`, `deriveVerdict`, `summariseBuckets`, `classifyDriver`, `computeFrameStats`, `parseTranslateX`, `kindFromStatus`.
- Constants and registries: `BLIND_SPOTS`, `JUDGING_PROTOCOL`, `FLAG_REGISTRY`, `LONG_GAP_MS`, `STALL_MS`, `STUCK_STATUS_MS`, `REPORT_SCHEMA_VERSION`.
- Environment probes: `captureEnvironment`, `detectEngine`, `developmentHints`, `isEmulationSuspected`, `sampleRafCadence`.
- Trace storage: `loadTrace`, `saveTrace`, `clearTrace`, `TRACE_KEY`.
