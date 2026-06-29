"use client";

import { useEffect, useState } from "react";

import { Layer } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

export interface SendSheetProps {
  onClose: () => void;
}

// A glass bottom sheet. <Layer> portals it out of the screen's content-isolation
// box to the scope level, so it overlays the whole phone, not just the scrolled
// content. This is the overlay leg of the dogfood: nested Router + Slot for the
// app, <Layer> for the sheet on top.
function SendSheet({ onClose }: SendSheetProps) {
  const dict = useShellDict();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(true);
  }, []);

  return (
    <Layer>
      <div className="absolute inset-0 z-10 flex items-end">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={`absolute inset-0 cursor-pointer bg-[var(--color-overlay)] transition-opacity duration-300 ${
            shown ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`relative w-full rounded-t-3xl border-t border-white/15 bg-[var(--color-bg)]/95 p-5 shadow-[0_-12px_40px_-12px_rgba(15,19,27,0.4)] backdrop-blur-xl transition-transform duration-300 ${
            shown ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-border-dark)]" />
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            {dict.wallet.sheet.title}
          </h3>
          <dl className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-[var(--color-text-secondary)]">
                {dict.wallet.sheet.amountLabel}
              </dt>
              <dd className="text-lg font-bold text-[var(--color-text-primary)]">₩50,000</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-[var(--color-text-secondary)]">
                {dict.wallet.sheet.toLabel}
              </dt>
              <dd className="text-sm font-semibold text-[var(--color-text-primary)]">
                {dict.wallet.sheet.toValue}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full cursor-pointer rounded-2xl bg-[var(--color-primary)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            {dict.wallet.sheet.confirm}
          </button>
        </div>
      </div>
    </Layer>
  );
}

export default SendSheet;
