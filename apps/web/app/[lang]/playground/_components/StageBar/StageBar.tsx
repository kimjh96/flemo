import type { ReactNode } from "react";

export interface StageBarProps {
  title: string;
  /** Rendered at the left: a back control on the screens that have one. */
  lead?: ReactNode;
  /** Rendered at the right: the screen's own action. */
  trail?: ReactNode;
}

// The bar both fixture screens hand to `sharedTopBar`, under one
// `sharedTopBarId`.
//
// That pairing is the whole demonstration: a shared bar is kept OUT of the
// screen transition, so it does not slide, fade or scale with the screens
// underneath it. The two screens pass different contents to the same position,
// and what the eye gets is a bar that stays put while its label and its
// controls change, which is what native chrome does and what a bar rendered
// inside each screen cannot do.
function StageBar({ title, lead, trail }: StageBarProps) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-[var(--color-border-light)] bg-[var(--color-bg)] px-3">
      <div className="flex size-8 items-center justify-center">{lead}</div>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--color-text-primary)]">
        {title}
      </span>
      {trail}
    </div>
  );
}

export default StageBar;
