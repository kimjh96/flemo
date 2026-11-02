# Measurement lifetime

Bar attachment measures before registration and writes the spacer immediately. Positive measurements update refs, local state, and the shared-bar store; these callbacks ignore nonpositive measurements. Matching partner metadata seeds the initial spacer until a local measurement is available.

Height observers depend on bar presence and the measurement callback, not the consumer's JSX node, avoiding teardown on every consumer render. A separate layout effect calls `publishRideBox(screenRef.current)` only while at least one shared bar exists, supplying screen dimensions for riding geometry.

Surface registration reads the scope's computed background color through `isOpaqueColor` and reruns for background-color and status changes. This supplies binding evidence for partner opacity, not a claim that every overlapping visual surface is opaque.
