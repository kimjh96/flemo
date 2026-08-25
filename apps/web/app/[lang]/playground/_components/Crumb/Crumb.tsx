"use client";

import { Part, usePathname } from "@flemo/react";

// A <Part> that lives OUTSIDE the <Slot>, beside the stack rather than in it.
//
// Two things are being shown at once. The first is that chrome outside the Slot
// survives every navigation: this strip is never unmounted, never re-rendered
// by a push, and never carried by a screen transition. The second is that it
// still MOVES with the flight — an outer Part is stamped with the same
// animation hold the screens are, so it runs on the navigation's own clock
// instead of appearing a beat after it. That stamp is the whole reason a Part
// may live out here at all: without it the strip would animate a full flight
// ahead of the screens it is describing.
function Crumb() {
  const path = usePathname();
  const tail = path.split("/").filter(Boolean).slice(-2).join(" / ");

  return (
    <Part
      name="crumb"
      className="flex h-7 items-center gap-2 border-t border-[var(--color-border-light)] bg-[var(--color-bg)] px-4"
    >
      <span className="size-1.5 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />
      <span className="truncate font-mono text-[11px] text-[var(--color-text-secondary)]">
        {tail}
      </span>
    </Part>
  );
}

export default Crumb;
