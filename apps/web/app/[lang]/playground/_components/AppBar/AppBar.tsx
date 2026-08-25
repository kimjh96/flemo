import type { ReactNode } from "react";

import { Part } from "@flemo/react";

export interface AppBarProps {
  title: string;
  /**
   * Which flavour of content motion this bar's screens are moving with:
   * `slide` for a transition that translates, `fade` for one that does not.
   * Naming it here is the point — an app bar is authored against the
   * transition underneath it, not in spite of it.
   */
  motion?: "slide" | "fade";
  /** The back control, on the screens that have somewhere to go back to. */
  lead?: ReactNode;
  /** The screen's own action, if it has one. */
  trail?: ReactNode;
}

// THE APP BAR, and the two halves of it that answer to different owners.
//
// The BOX is a shared bar: every screen in a stack hands the same one up under
// the same id, so flemo keeps it out of the screen transition and it holds its
// place while the screens travel underneath. Nothing about it slides.
//
// The CONTENTS are the screen's, and they move with the flight: `<Part>` on the
// label and the controls, so a push carries the old title out the way its
// screen is going and brings the new one in from the other side, inside a box
// that never moved. That is the difference between an app bar that is connected
// to the navigation and one that swaps at the end of it.
//
// A screen that wants none of this simply declares no bar, and the whole thing
// animates away with its own motion — see the full-bleed steps.
function AppBar({ title, lead, trail, motion = "fade" }: AppBarProps) {
  const part = motion === "slide" ? "bar-slide" : "bar-fade";
  return (
    <div className="flex h-12 items-center gap-2 border-b border-[var(--color-border-light)] bg-[var(--color-bg)] px-3">
      <Part name={part} className="flex size-8 shrink-0 items-center justify-center">
        {lead}
      </Part>
      <Part name={part} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[var(--color-text-primary)]">
          {title}
        </span>
      </Part>
      <Part name={part} className="shrink-0">
        {trail}
      </Part>
    </div>
  );
}

export default AppBar;
