import type { ReactNode } from "react";

import { Part } from "@flemo/react";

export interface StageBarProps {
  title: string;
  /** Rendered at the left: a back control on the screens that have one. */
  lead?: ReactNode;
  /** Rendered at the right: the screen's own action. */
  trail?: ReactNode;
}

// The bar both inner screens hand to `sharedTopBar`, under one
// `sharedTopBarId`.
//
// The bar itself is kept OUT of the screen transition — that is what a shared
// bar is — so it holds its place while the screens travel underneath. Its
// CONTENTS are a different question, and the answer is `<Part>`: the label and
// the controls run the screen's lifecycle on the screen's clock, inside a bar
// that does not move. Without them the bar swaps at the end of the flight and
// a pop is named after the screen it is leaving the whole way back.
function StageBar({ title, lead, trail }: StageBarProps) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-[var(--color-border-light)] bg-[var(--color-bg)] px-3">
      <Part name="bar-content" className="flex size-8 items-center justify-center">
        {lead}
      </Part>
      <Part name="bar-content" className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[var(--color-text-primary)]">
          {title}
        </span>
      </Part>
      <Part name="bar-content">{trail}</Part>
    </div>
  );
}

export default StageBar;
