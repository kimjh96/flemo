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
 * The gate, the dedupe and the destination, in one place.
 *
 * Every report below used to carry its own copy of these four lines, which is
 * one copy per report to keep in step: a warning that forgot the environment
 * check would ship to production, and one that forgot the set would fire on
 * every frame of every flight. The console IS the destination for all of them,
 * because each fires only on a consumer's own misconfiguration, which flemo
 * cannot fix for them, and only in development.
 */
const sayOnce = (key: string, message: string): void => {
  if (!isDevEnvironment() || typeof console === "undefined") return;
  if (said.has(key)) return;
  said.add(key);
  // eslint-disable-next-line no-console
  console.error(message);
};

/**
 * Say once, in development, that a name resolved to nothing.
 *
 * `key` is what makes it once — the name itself, scoped by the kind of thing
 * it was looked up in, so a part and a transition sharing a name are two
 * reports rather than one.
 */
export const warnUnregistered = (kind: string, name: string, remedy: string): void =>
  sayOnce(
    `${kind}:${name}`,
    `[flemo] No ${kind} is registered under "${name}", so nothing was applied. ${remedy}`
  );

/**
 * Say once, in development, that a morph's `exit` pose keeps its departure on
 * glass.
 *
 * A morph's `exit` is not a fade. The runtime pins the departing element at
 * that variant's END pose from the flight's first frame and holds it there
 * ("CUT FROM THE FIRST FRAME", attachMorph), because a window narrow enough to
 * be invisible is still a window a dropped frame can land in. So a pose that
 * does not reach `opacity: 0` is an instruction to keep painting the element
 * the flight is carrying away from.
 *
 * Every built-in preset writes `opacity: 0`, which reads as taste and is a
 * contract. Authored as `1` on this repository's own card-open page, a push hid
 * it (the growing card covers the cell) and a pop showed it: the full-bleed
 * page sat behind the shrinking card and was uncovered as it landed. Nothing
 * failed; it just looked wrong, for a day.
 */
export const warnDepartureNotHidden = (name: string, opacity: unknown): void =>
  sayOnce(
    `morph-exit:${name}`,
    `[flemo] The morph "${name}" leaves its departure visible: its \`exit\` pose ends with ` +
      `${opacity === undefined ? "no opacity" : `opacity ${String(opacity)}`}, and that pose is ` +
      "the CUT the runtime pins the departing element at for the whole flight. Every preset ends " +
      "`exit` at `opacity: 0`; anything else keeps painting the element you are flying away " +
      "from, which a push usually covers and a pop reveals."
  );

/**
 * Say once, in development, that a morph camera and its screen are both trying
 * to move the same transform.
 *
 * `carry: "screen"` IS that screen's motion for the flight, and two authors of
 * one transform is not a thing CSS composes: the camera supersedes the screen's
 * own pose rather than adding to it. The rule is in `zoom`'s own doc comment
 * ("PAIR IT WITH A STILL SCREEN TRANSITION") and there was no way to notice
 * breaking it except by watching the screen's authored slide disappear.
 */
export const warnCameraOverridesScreen = (name: string, transitionName: string): void =>
  sayOnce(
    `morph-camera:${name}:${transitionName}`,
    `[flemo] The morph "${name}" carries a camera and the screen transition ` +
      `"${transitionName}" moves the screen itself. The camera supersedes that motion for the ` +
      "flight, so the transition's own travel is discarded rather than combined. Pair a camera " +
      "with a still transition (`none`, or one that only fades)."
  );

export default warnUnregistered;
