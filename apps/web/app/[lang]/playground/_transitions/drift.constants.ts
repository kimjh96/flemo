// Shared by `drift` and by the `recess` decorator it names, so the transition
// and its dim cannot drift apart when either is retuned. The pair is the whole
// point of the case: a decorator is compiled once per NAME with the durations
// its author wrote, so an author who borrows someone else's dim inherits
// someone else's clock.
export const DRIFT_IN = 0.42;
export const DRIFT_BACK = 0.32;

// One curve for the whole flight. Both channels of `drift` move together, so
// giving opacity and scale different easings would make the arriving screen
// finish fading before it finished growing.
export const DRIFT_EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

// How far the covered screen retreats. Small on purpose: this is depth, not a
// zoom, and the shared element crossing above it is the thing meant to be
// followed.
export const DRIFT_RECEDE = 0.94;
export const DRIFT_APPROACH = 1.05;
