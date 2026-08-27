// The shell's peer destinations, in nav order. The index decides the
// shared-axis direction: a higher index slides forward, a lower one slides back.
export const SHELL_ORDER = ["/", "/showcase", "/playground", "/docs"] as const;

export type ShellPath = (typeof SHELL_ORDER)[number];
