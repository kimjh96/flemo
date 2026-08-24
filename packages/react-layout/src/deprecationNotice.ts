// `process` is not in the DOM lib and this package pulls no node types into its
// published typings, so declare the single field the gate reads — the same
// shape @flemo/react's devDiagnostics uses.
declare const process: { env?: { NODE_ENV?: string } } | undefined;

let warned = false;

/**
 * The one-time notice that this package has been superseded.
 *
 * Shared-element morphing is no longer a motion adapter bolted onto a Screen:
 * it is `<Morph>` in `@flemo/react`, over a framework-neutral runtime in
 * `@flemo/core`. This package is kept for one release so an existing install
 * keeps working and says where it went, and is then removed.
 *
 * Development only. A deprecation notice is for the person editing the code,
 * and a production bundle should not carry the string, let alone print it.
 */
export default function deprecationNotice(component: string): void {
  if (typeof process === "undefined" || process?.env?.NODE_ENV === "production") return;
  if (warned) return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn(
    `[flemo] ${component} (@flemo/react-layout) is deprecated and this is its last release.\n` +
      `Shared elements are now <Morph layoutId="..."> from @flemo/react, with no motion peer dependency:\n` +
      `  - LayoutScreen  → Screen (a screen carrying a travelling element stops covering its partner on its own)\n` +
      `  - LayoutConfig  → nothing; a morph already runs on the screen transition's timing\n` +
      `  - motion.* + layoutId → <Morph layoutId="...">\n` +
      `See https://flemo.dev/docs/morph`
  );
}
