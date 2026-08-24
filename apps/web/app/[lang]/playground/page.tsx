import type { Metadata } from "next";

import ChainStage from "./_components/ChainStage";
import PlaygroundStage from "./_components/PlaygroundStage";

// The library's fixture surface, not a marketing page: it exists so a change to
// flemo's motion can be looked at full size, on a production build, instead of
// being judged through a half-covered card in the landing hero.
//
// Everything on it is arranged around that one job. The two benches are the
// same object at the same size so what they show can be compared; the page
// holds still while they run, because anything animating out here would land in
// the frames being judged.
export const metadata: Metadata = {
  title: "Morph playground",
  robots: { index: false, follow: false }
};

export default function PlaygroundPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-xs font-semibold tracking-[0.18em] text-[var(--color-text-disabled)] uppercase">
          fixture
        </span>
        <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
          Morph playground
        </h1>
        <p className="max-w-[62ch] text-base leading-relaxed text-[var(--color-text-secondary)]">
          One <code className="font-mono text-[var(--color-primary)]">layoutId</code>, two screens.
          The card you tap, the artwork inside it and its title are the same three elements on both
          sides — flemo measures where each one is the instant a navigation starts and flies it,
          above both screens, on the screen transition&rsquo;s own clock.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <PlaygroundStage />
        <ChainStage />
      </div>

      <footer className="text-xs leading-relaxed text-[var(--color-text-disabled)]">
        Judge on a production build, with devtools closed. Arm{" "}
        <code className="font-mono">?flemo:morph=on</code> to record every flight decision on{" "}
        <code className="font-mono">globalThis.flemoMorphTrace</code>.
      </footer>
    </main>
  );
}
