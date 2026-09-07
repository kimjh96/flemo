// `sheet`'s own two spans. detailChrome.ts used to read the push length from
// here to write a literal delay for the detail's header; a part asks the flight
// for that now (`after: "flight"`), so these are `sheet`'s alone.
export const SHEET_IN = 0.42;
export const SHEET_OUT = 0.34;
export const SHEET_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
