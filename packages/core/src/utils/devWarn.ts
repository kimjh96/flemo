// A NAME THAT RESOLVES TO NOTHING SHOULD SAY SO.
//
// Every registry in flemo is keyed by a name a consumer writes: a transition,
// a part transition, a decorator, a morph transition. Every lookup was total —
// a miss fell back to something inert and said nothing — so a typo, a
// forgotten `<Router transitions={...}>` entry, or a name built from data with
// a case nobody added produced an element that sits perfectly still while the
// DOM says everything is fine. That is the hardest kind of bug to see, because
// there is nothing to see.
//
// It cost a day here: the playground's `tether` case asked for a part
// transition named `chrome-tether`, the table that generates them had no row
// for it, and the detail's header simply appeared instead of animating. The
// attribute was on the element, the name was spelled right, and nothing in any
// build said a word.
//
// The gate is the bundler-substituted `process.env.NODE_ENV`, guarded by a
// `typeof` check so an unbundled browser context (no `process`) reads as
// production rather than throwing. The library's own build preserves the
// expression (see the `define` in vite.config.mts), so the CONSUMER's bundler
// decides — exactly as `@flemo/react`'s devDiagnostics does.
declare const process: { env?: { NODE_ENV?: string } } | undefined;

const isDevEnvironment = (): boolean =>
  typeof process !== "undefined" && process?.env?.NODE_ENV !== "production";

/**
 * Names already reported, so a lookup on every frame of every flight cannot
 * turn one mistake into a console full of them.
 */
const said = new Set<string>();

/* v8 ignore next 3 -- test hook: the set is module-global. */
export const resetDevWarningsForTesting = (): void => {
  said.clear();
};

/**
 * Say once, in development, that a name resolved to nothing.
 *
 * `key` is what makes it once — the name itself, scoped by the kind of thing
 * it was looked up in, so a part and a transition sharing a name are two
 * reports rather than one.
 */
export const warnUnregistered = (kind: string, name: string, remedy: string): void => {
  if (!isDevEnvironment() || typeof console === "undefined") return;
  const key = `${kind}:${name}`;
  if (said.has(key)) return;
  said.add(key);
  // The console IS the destination: this only fires on a consumer's own
  // misconfiguration, which flemo cannot fix for them, and only in
  // development.
  // eslint-disable-next-line no-console
  console.error(
    `[flemo] No ${kind} is registered under "${name}", so nothing was applied. ${remedy}`
  );
};

export default warnUnregistered;
