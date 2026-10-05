"use client";

import { Layer } from "@flemo/react";

import Icon from "@/components/Icon";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

export interface TripMenuProps {
  onClose: () => void;
}

// A bottom sheet opened from the panel. Inside the panel's screen it would be
// drawn under the app's header and clipped to the panel; in a Layer it is drawn
// in the app's Layer host, above the header, across the whole phone.
function TripMenu({ onClose }: TripMenuProps) {
  const t = useShellDict().mini.trip;

  return (
    <Layer>
      <div className="absolute inset-0 flex items-end bg-black/40" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.menuTitle}
          onClick={(event) => event.stopPropagation()}
          className="w-full rounded-t-2xl border-t border-line bg-surface px-3 pt-3 pb-4"
        >
          <div className="flex items-center justify-between pb-2 pl-2">
            <span className="text-sm font-semibold text-fg">{t.menuTitle}</span>
            <button
              type="button"
              aria-label={t.close}
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
          <ul className="flex flex-col">
            {t.menuItems.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-lg px-2 py-2.5 text-left text-sm text-fg transition-colors hover:bg-surface-2"
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layer>
  );
}

export default TripMenu;
