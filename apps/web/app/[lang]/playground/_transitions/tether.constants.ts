// Shared with detailChrome.ts, which needs the push length for its clock table
// the same way it needs drift's and sheet's. A PART does not inherit a flight's
// clock, so the one number the header has to hold for lives here rather than
// being copied into a table that cannot be checked against it.
export const TETHER_IN = 0.5;
export const TETHER_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
