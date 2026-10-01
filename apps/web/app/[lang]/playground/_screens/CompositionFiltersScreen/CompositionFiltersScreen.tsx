"use client";

import { Screen, useNavigate } from "@flemo/react";

function CompositionFiltersScreen() {
  const navigate = useNavigate();

  return (
    <Screen
      hideStatusBar
      hideSystemNavigationBar
      backgroundColor="transparent"
      contentScrollable={false}
    >
      <div
        data-testid="composition-pane-filters"
        className="h-full bg-indigo-50 p-3 dark:bg-indigo-950/30"
      >
        <button
          type="button"
          onClick={() => navigate.pop()}
          className="cursor-pointer text-[12px] font-bold text-indigo-600 dark:text-indigo-300"
        >
          ← Local back
        </button>
        <p className="mt-4 text-[11px] font-bold tracking-[0.16em] text-slate-400 uppercase">
          Inner Router
        </p>
        <h3 className="mt-1 text-lg font-extrabold text-slate-950 dark:text-white">Filters</h3>
        <div className="mt-4 flex gap-2">
          {["Unread", "Pinned", "Today"].map((filter) => (
            <span
              key={filter}
              className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300"
            >
              {filter}
            </span>
          ))}
        </div>
      </div>
    </Screen>
  );
}

export default CompositionFiltersScreen;
