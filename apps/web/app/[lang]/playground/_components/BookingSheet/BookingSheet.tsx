"use client";

import { Layer } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import { useBench } from "../../_providers/BenchContext";

export interface BookingSheetProps {
  onClose: () => void;
}

// A bottom sheet that has to cover the tab bar — the one thing `<Layer>` exists
// for, written the way a consumer writes it: `position: fixed`, on the floor,
// with a z-index of its own.
//
// THE SAME MARKUP GOES OUT BOTH WAYS. The only difference between the two runs
// is whether `<Layer>` wraps it, so anything that differs on screen is
// attributable to that and nothing else.
//
// AT REST THERE IS NO DIFFERENCE, and the docs say so plainly:
//
//   Layer.tsx
//     "At rest none of this is needed: a screen at rest carries no transform,
//      so a consumer's `position: fixed` overlay already resolves against the
//      viewport and already outranks the bars with a z-index of its own.
//      `<Layer>` is for the overlay that has to survive the screen MOVING under
//      it, and for the one that has to clear chrome an ancestor screen
//      declared."
//
// So the comparison only means anything while a screen is moving: open the
// sheet, then tap a row. A screen that is moving carries a transform, and a
// transform is a containing block for `position: fixed` descendants — an inline
// sheet stops resolving against the viewport and starts resolving against the
// screen box, which ends one tab bar short of the floor.
function Sheet({ onClose }: BookingSheetProps) {
  const { hosted } = useBench();
  const t = getDict(useShellLang()).playground.app;

  return (
    <div
      data-booking-sheet={hosted ? "hosted" : "inline"}
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-[var(--color-border)] bg-[var(--color-layer)] p-5 shadow-[0_-18px_40px_-24px_rgba(15,23,42,0.45)]"
    >
      <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-[var(--color-border)]" />
      <h3 className="text-base font-extrabold text-[var(--color-text-primary)]">{t.sheetTitle}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
        {t.sheetBody}
      </p>
      <button
        type="button"
        data-booking-sheet-close=""
        onClick={onClose}
        className="mt-4 w-full cursor-pointer rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white"
      >
        {t.sheetClose}
      </button>
    </div>
  );
}

// Same element, two placements. `<Layer>` is the entire difference.
function BookingSheet(props: BookingSheetProps) {
  const { hosted } = useBench();

  return hosted ? (
    <Layer>
      <Sheet {...props} />
    </Layer>
  ) : (
    <Sheet {...props} />
  );
}

export default BookingSheet;
