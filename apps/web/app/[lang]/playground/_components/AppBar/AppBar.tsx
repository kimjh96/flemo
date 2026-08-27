"use client";

import type { ReactNode } from "react";

import { Part } from "@flemo/react";

export interface AppBarProps {
  title: string;
  /**
   * The part transition to run on the contents. Passed in rather than chosen
   * here, because the right one depends on the screen transition currently
   * flying — see `clocks.ts`. Callers get it from `useMotionChoice().barPart`
   * or from the booking step's own transition, never by hardcoding a name.
   */
  part: string;
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
// The CONTENTS are the screen's, and they move with the flight — `<Part>` on
// the label and the controls, so a push carries the old title out the way its
// screen is going and brings the new one in from the other side, inside a box
// that never moved. That is the difference between an app bar connected to the
// navigation and one that swaps at the end of it.
//
// THE PART NAME IS A PROP, and that is the correction this rebuild exists for.
// The old bar picked between two hardcoded transitions of its own, both timed
// at 0.34s, while the bench switched the screen transition underneath it at
// runtime. Under cupertino (0.7s) the hand-over was measured 97% complete at
// 200ms with the screens still half a width from home: the bar finished, then
// the screens kept going. A bar's contents belong to the flight carrying them,
// so the flight names their clock.
//
// A screen that wants none of this simply declares no bar, and the whole thing
// animates away with its own motion — see the full-bleed steps.
function AppBar({ title, part, lead, trail }: AppBarProps) {
  return (
    <div className="flex h-12 items-center gap-1 border-b border-[var(--color-border-light)] bg-[var(--color-bg)] px-2">
      <Part name={part} className="flex size-9 shrink-0 items-center justify-center">
        {lead}
      </Part>
      <Part name={part} className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold tracking-[-0.01em] text-[var(--color-text-primary)]">
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
