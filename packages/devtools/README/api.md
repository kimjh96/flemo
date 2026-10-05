# API

- `attachTransitionRecorder(options?)` starts recording transitions and returns `{ report(), mark(), detach() }`. Options: `maxTransitions` (50, the number of transitions kept), `log` (`false`), `installGlobal` (`true`), `persist` (`true`).
- `attachDevtoolsHud(options?)` returns `{ detach() }`. Options: `recorder`, `position` (`"bottom-right"`), `initialExpanded` (`false`), `initialHidden`, `buckets`.
- `attachDevtoolsPanel(options?)` returns `{ detach() }`. Options: `recorder`, `initialOpen` (`false`), `position` (`"bottom-right"`), `buckets`.
- Pure helpers: `deriveTransitionAnomalies`, `deriveReportAnomalies`, `deriveOverrideWarnings`, `derivePreconditions`, `deriveVerdict`, `summariseBuckets`, `classifyDriver`, `computeFrameStats`, `parseTranslateX`, `kindFromStatus`.
- Constants and registries: `BLIND_SPOTS`, `JUDGING_PROTOCOL`, `FLAG_REGISTRY`, `LONG_GAP_MS`, `STALL_MS`, `STUCK_STATUS_MS`, `REPORT_SCHEMA_VERSION`.
- Environment probes: `captureEnvironment`, `detectEngine`, `developmentHints`, `isEmulationSuspected`, `sampleRafCadence`.
- Trace storage: `loadTrace`, `saveTrace`, `clearTrace`, `TRACE_KEY`.
- Types: `FlemoReport`, `TransitionRecord`, `TransitionRecorderHandle`, `TransitionRecorderOptions`, `EndAudit`, `MorphActivity`, `MotionProgress`, `Precondition`.
