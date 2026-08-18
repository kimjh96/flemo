// The judging protocol.
//
// Every report carries this list, because the 2026-08 campaign's final
// attribution was not a bug in the library at all: the residual stutter the
// user chased for weeks reproduced only in sessions with DevTools OPEN, and
// vanished when it was closed (bidirectionally verified on the reporting
// machine). Two more observation traps had already cost rounds before that —
// a running screen capture forces the compositor to a steady cadence and
// SUPPRESSES the symptom, and synthetic clicks skip the pointerdown-armed
// machinery entirely.
//
// None of these are visible from inside the page, so the report cannot check
// them for you. It states them instead: a verdict taken outside this protocol
// is not evidence, and an agent reading a "clean" report from a DevTools-open
// session must not conclude the motion is clean.
export const JUDGING_PROTOCOL: readonly string[] = [
  "DevTools must be CLOSED while judging motion. An open inspector serializes " +
    "requests and repaints its own panels on the same machine; the 2026-08 campaign's " +
    "entire residual 'stutter' was this, and it is invisible to every in-page metric.",
  "No screen recording or display capture while judging. A capture client forces " +
    "WindowServer to composite every vsync, which SUPPRESSES the symptom — a capture " +
    "that looks smooth proves nothing about the uncaptured session.",
  "Judge with real input (a finger, a mouse). Synthetic dispatch — evaluate().click() " +
    "and friends — never fires pointerdown, so it bypasses the swipe/gesture machinery " +
    "that a real navigation goes through.",
  "Establish the viewing configuration before believing any verdict: device emulation " +
    "off, which physical display, its refresh rate and HiDPI scaling, Low Power Mode. " +
    "Ask for a photo of the setup if it is not certain."
];
