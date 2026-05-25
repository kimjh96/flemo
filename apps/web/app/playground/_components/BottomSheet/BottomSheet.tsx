"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  trailing?: ReactNode;
}

function BottomSheet({ open, onClose, title, children, trailing }: BottomSheetProps) {
  // Freeze children during the exit animation so the sheet doesn't flash
  // empty while it slides down. We refresh the snapshot whenever the
  // sheet is open.
  const lastChildren = useRef<ReactNode>(null);
  if (open) lastChildren.current = children;
  const body = open ? children : lastChildren.current;

  return (
    <>
      <button
        type="button"
        aria-label="Dismiss sheet"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(15,19,27,0.35)] transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        data-flemo-bottom-sheet={open ? "open" : "closed"}
        className="absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-2xl border-t border-[var(--color-line)] bg-[var(--color-surface)] px-5 pb-6 pt-3 shadow-[0_-12px_32px_-12px_rgba(15,19,27,0.18)] transition-transform duration-300 ease-out"
        style={{
          transform: open ? "translateY(0)" : "translateY(100%)",
          pointerEvents: open ? "auto" : "none"
        }}
      >
        <div className="mx-auto h-1 w-9 rounded-full bg-[var(--color-text-primary)]/15" />
        <header className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <div className="flex items-center gap-2">
            {trailing}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              data-flemo-bottom-sheet-close
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)]/5"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  d="M4 4l10 10M14 4L4 14"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </header>
        <div className="flex flex-col">{body}</div>
      </section>
    </>
  );
}

export default BottomSheet;
