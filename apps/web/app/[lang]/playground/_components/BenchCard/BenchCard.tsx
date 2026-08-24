import type { PropsWithChildren, ReactNode } from "react";

export interface BenchCardProps extends PropsWithChildren {
  /** What this bench asks. Short enough to read as a claim, not a title. */
  title: string;
  /** The question under it, in one sentence. */
  question: string;
  /** The controls or legend that belong to this bench, above the stage. */
  controls?: ReactNode;
}

// One bench: a claim, the question it is set up to answer, its own controls,
// and the stage they drive.
//
// The two benches on this page are deliberately the same object at the same
// size. They are answering different questions — one transition at a time
// versus five of them stacked — and the only honest way to compare what they
// show is for everything around the glass to be identical.
function BenchCard({ title, question, controls, children }: BenchCardProps) {
  return (
    <section className="flex h-full flex-col gap-5 rounded-3xl border border-[var(--color-border-light)] bg-[var(--color-layer)] p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold tracking-[-0.01em] text-[var(--color-text-primary)]">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{question}</p>
      </header>
      {controls}
      {/* The stages are pinned to the bottom of their cards, so two benches
          whose controls are different heights still start their glass on the
          same line. Comparing what they show depends on it. */}
      <div className="mt-auto">{children}</div>
    </section>
  );
}

export default BenchCard;
