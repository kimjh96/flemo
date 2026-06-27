"use client";

import { useNavigate } from "@flemo/react";

function FetchSwapAppBar() {
  const navigate = useNavigate();
  const handleBack = () => navigate.pop();

  return (
    <header className="flex items-center gap-2 bg-[var(--color-surface)] px-2 py-2">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Back"
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-brand)] hover:bg-[var(--color-layer)]"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M12 4L6 10L12 16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="truncate text-[14px] font-semibold text-[var(--color-text-primary)]">
          Fetch Swap
        </div>
      </div>
      <div className="h-9 w-9" />
    </header>
  );
}

export default FetchSwapAppBar;
