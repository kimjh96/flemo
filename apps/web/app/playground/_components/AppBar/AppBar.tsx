import { useNavigate } from "flemo";
import type { ReactNode } from "react";

import Icon from "../Icon";

export default function AppBar({
  title,
  showBack = false,
  trailing,
  bordered = true
}: {
  title: ReactNode;
  showBack?: boolean;
  trailing?: ReactNode;
  bordered?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div
      className={`flex h-12 w-full items-center justify-between bg-[var(--color-surface)] px-2 ${
        bordered ? "border-b border-[var(--color-line)]" : ""
      }`}
    >
      <div className="flex w-12 items-center justify-start">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate.pop()}
            className="flex size-10 items-center justify-center rounded-full text-[var(--color-ink)] active:opacity-60"
            aria-label="Back"
          >
            <Icon name="back" size={22} />
          </button>
        )}
      </div>
      <div className="flex-1 truncate text-center text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
        {title}
      </div>
      <div className="flex w-12 items-center justify-end">{trailing}</div>
    </div>
  );
}
