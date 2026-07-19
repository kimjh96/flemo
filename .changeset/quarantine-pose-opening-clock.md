---
"@flemo/core": patch
---

Make the flight-time animation quarantine pose-preserving: each consumer animation is pinned to its first-keyframe pose during the flight and rejoined to its original clock at the landing, so delayed reveals (skeleton gating) never flash their base styles mid-flight or restart their delay at rest. Add an opening-clock guard for the compiled CSS driver: when a main-thread block right after the anim-hold release eats a transition's opening (WebKit anchors the clock at the release commit), the never-presented span is rewound on the first frame, so heavy warm navigations play their full motion instead of appearing to start past the middle.
