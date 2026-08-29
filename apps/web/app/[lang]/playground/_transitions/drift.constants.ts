// `drift`'s own two spans. They were shared with the `recess` decorator too,
// because a decorator used to be compiled once per NAME with the durations its
// author wrote and the pair had no other way to stay matched. A decorator now
// takes the clock of the transition that names it, so `recess` authors no
// duration at all and this file is read by `drift` and by `detailChrome`, which
// still needs the push length for its own table (a PART does not inherit).
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
