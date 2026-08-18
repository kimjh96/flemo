---
"@flemo/devtools": minor
"@flemo/web": patch
---

Teach the flight recorder to see the defects that frame timing cannot, and give it a visual panel.

Report schema v2 adds `flights[].motion` (did the pose actually advance, read from the compiled animation's own clock or the player's inline pose — neither forces a style flush), `flights[].images` (still-loading images that completed mid-flight versus the ones the engine held), `landing.orphanedHolds` (hold markers left on the page at rest), and a constant `judgingProtocol` the page cannot verify but must state: judge with DevTools closed, no capture running, real input. Every one of these guards a defect that shipped during the 2026-08 campaign while rAF ticked at a clean 16.7ms throughout.

`attachDevtoolsPanel()` mounts a shadow-root panel — floating toggle, flight list, per-flight detail with the findings toned — for the human half of the audience. It never touches the DOM while a flight is in progress, because an instrument that repaints during a transition reproduces the very artifact it is there to measure.
