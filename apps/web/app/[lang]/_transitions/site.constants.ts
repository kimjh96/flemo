// Tuning for the site's lateral move between its top-level sections. Sections
// are peers, not parent and child, so this is a short offset and a fade rather
// than a full-width push, and it has no swipe: going "back" between peers is a
// header tap, not a gesture.
export const SITE_OFFSET = "24px";

export const SITE_EASE = [0.2, 0.8, 0.2, 1] as const;

export const SITE_DURATION = 0.34;

export const SITE_DURATION_BACK = 0.28;
