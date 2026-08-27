"use client";

import { useLayerCase } from "../../_providers/LayerCaseContext";

// The tab bar the overlay has to beat.
//
// TWO THINGS ARE FROZEN HERE and neither is a style choice.
//
// The HEIGHT (72px) is load-bearing. When the sheet is written inline, the
// moving screen becomes a containing block and the sheet's floor stops being
// the viewport and starts being the screen box — which ends exactly one bar
// above it. `layer.spec.ts` asserts that gap is at least 60px, so shrinking
// this bar would quietly turn a real regression into a passing test.
//
// The CENTRE MARK is the instrument. The sheet is deliberately narrower than
// the bar, so both are on screen at once and the verdict is a single visual
// fact: does the sheet cut through the middle while the bar still shows at the
// sides? A readout would have been easier to write and worthless to trust —
// this is a judging stage, and the eye is the instrument. It reads as an
// active-tab indicator, which is what it also is.
//
// What changed in the rebuild is only what it is made of: the site's own
// palette rather than fluorescent yellow on black. The contrast that makes the
// verdict unambiguous is preserved, because that contrast is a requirement.
function LayerTabBar() {
  const { copy } = useLayerCase();

  return (
    <nav
      data-layer-bar=""
      aria-label={copy.title}
      className="relative flex h-[72px] w-full items-center justify-center border-t border-[var(--color-border)] bg-[var(--color-bg)]"
    >
      <span className="absolute inset-y-0 left-1/2 w-[8px] -translate-x-1/2 bg-[var(--color-text-primary)]" />
      {/* Flanking the mark rather than sitting on it, so the mark stays a
          clean read at the exact point the suite samples. */}
      <span className="flex w-full items-center justify-between px-6 text-[13px] font-semibold text-[var(--color-text-disabled)]">
        <span>{copy.sectionA}</span>
        <span>{copy.sectionB}</span>
      </span>
    </nav>
  );
}

export default LayerTabBar;
