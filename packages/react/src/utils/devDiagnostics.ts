// Development-only diagnostics for consumer mistakes flemo can detect but must
// never crash a production app over.
//
// The gate is the bundler-substituted `process.env.NODE_ENV`, guarded by a
// `typeof` check so an unbundled browser context (no `process`) reads as
// production instead of throwing a ReferenceError. The library's own build
// preserves the expression rather than folding it to "production" (see the
// `define` in vite.config.mts), so the CONSUMER's bundler decides.
// `process` is not in the DOM lib and this package pulls no node types into
// its published typings, so declare the single field the gate reads.
declare const process: { env?: { NODE_ENV?: string } } | undefined;

function isDevEnvironment(): boolean {
  return typeof process !== "undefined" && process?.env?.NODE_ENV !== "production";
}

// A recoverable mistake: report it loudly in development, then carry on. Used
// where flemo can still do something sensible (and where changing the outcome
// would break existing apps).
export function devWarn(message: string): void {
  if (!isDevEnvironment() || typeof console === "undefined") return;
  // The console IS the destination: this only ever fires on a consumer
  // misconfiguration flemo cannot fix for them, and only in development.
  // eslint-disable-next-line no-console
  console.error(`[flemo] ${message}`);
}

// An unrecoverable mistake: nothing sensible can be done, so fail at the call
// site in development (the stack points straight at the offending navigation).
// Production keeps the pre-existing behavior — the caller treats a return as
// "do nothing" — because throwing there would turn a mis-typed Router name
// into a white screen.
export function devFail(message: string): void {
  if (!isDevEnvironment()) return;
  throw new Error(`[flemo] ${message}`);
}
