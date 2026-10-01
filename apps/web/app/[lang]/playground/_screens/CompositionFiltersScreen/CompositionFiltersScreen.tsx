"use client";

import { Screen, useNavigate } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

function CompositionFiltersScreen() {
  const navigate = useNavigate();
  const isKo = useShellLang() === "ko";

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
          ← {isKo ? "돌아가기" : "Local back"}
        </button>
        <p className="mt-4 text-[11px] font-bold tracking-[0.16em] text-slate-400 uppercase">
          {isKo ? "이 영역의 화면" : "In-app screen"}
        </p>
        <h3 className="mt-1 text-lg font-extrabold text-slate-950 dark:text-white">
          {isKo ? "필터" : "Filters"}
        </h3>
        <div className="mt-4 flex gap-2">
          {(isKo ? ["읽지 않음", "고정됨", "오늘"] : ["Unread", "Pinned", "Today"]).map(
            (filter) => (
              <span
                key={filter}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300"
              >
                {filter}
              </span>
            )
          )}
        </div>
      </div>
    </Screen>
  );
}

export default CompositionFiltersScreen;
