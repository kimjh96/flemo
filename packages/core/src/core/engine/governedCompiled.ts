import { detectBlinkEngine } from "@core/engine/driverPolicy";

// THE TOUCH-WEBKIT GOVERNED-COMPILED TIER: compiled keyframes, the governed
// head, and the synchronous atomic release. Every slide on touch WebKit runs
// it — routing, the head gate attribute and the release all key off this one
// predicate.
//
// It began as an iOS Low Power Mode question. LPM caps requestAnimationFrame
// at ~30Hz while the compositor keeps presenting at the panel rate, so the
// rAF-driven player could only ever produce half the frames there, and slides
// were routed to the compiled tier WHEN LPM WAS DETECTED. Detecting it was a
// whole apparatus: a probe fired at module evaluation and again per routed
// flight, a continuous rAF monitor kept a rolling window of frame gaps so a
// verdict was ready before the first navigation, and the last verdict
// persisted in sessionStorage across reloads.
//
// The treatment then proved right whether or not the device was in Low Power
// Mode (device-confirmed 2026-08 on a 60Hz iPhone with LPM off), so it became
// the default for every touch-WebKit flight — and the detection had nothing
// left to gate. It was kept "fresh" for another campaign or two, read by
// nobody, until the 2026-08-22 audit found `lowPowerCadenceActive` with zero
// internal callers and `lowPowerFrameIntervalMs` with none at all.
//
// It was not free while it lasted: a rAF loop from module load to the end of
// the session, six more frames per routed flight, a probe per visibility
// return, and sessionStorage on both. That is per-frame main-thread work on
// exactly the devices where the main thread is the scarce resource — the
// finding the swipe campaign closed on (see createSwipeController). Retired
// 2026-08-22.
//
// What survives is the predicate the routing actually asks for: non-Blink and
// a touch device. Nothing here measures a cadence, and nothing should: a
// treatment that is right for the whole engine does not need to know whether
// the battery is low.
export const governedCompiledActive = (): boolean =>
  !detectBlinkEngine() && typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
