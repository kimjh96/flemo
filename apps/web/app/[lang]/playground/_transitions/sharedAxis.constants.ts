// Shared tuning for the two shared-axis (X) transitions. A short lateral offset
// (not a full-width push) plus a fade is the canonical Material pattern for
// moving between peer destinations. The matched ease is Material's standard
// curve so forward and backward feel like one motion played in reverse.
export const SHARED_AXIS_OFFSET = "28px";

export const SHARED_AXIS_EASE = [0.4, 0, 0.2, 1] as const;
