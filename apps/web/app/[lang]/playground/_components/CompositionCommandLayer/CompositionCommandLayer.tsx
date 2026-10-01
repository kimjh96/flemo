"use client";

import { Layer } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

export interface CompositionCommandLayerProps {
  onClose: () => void;
}

function CompositionCommandLayer({ onClose }: CompositionCommandLayerProps) {
  const isKo = useShellLang() === "ko";
  return (
    <Layer>
      <div
        data-testid="composition-layer-overlay"
        className="absolute inset-0 z-50 grid place-items-center bg-slate-950/58 p-6 backdrop-blur-[3px]"
        onClick={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="composition-layer-title"
          className="w-full max-w-sm rounded-[28px] border border-white/20 bg-white p-5 text-slate-950 shadow-[0_28px_90px_rgba(15,23,42,0.45)] dark:bg-slate-950 dark:text-white"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold tracking-[0.16em] text-indigo-500 uppercase">
                {isKo ? "앱 위의 패널" : "Panel above the app"}
              </p>
              <h3 id="composition-layer-title" className="mt-1 text-xl font-black">
                {isKo ? "빠른 작업" : "Quick actions"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={isKo ? "패널 닫기" : "Close command layer"}
              className="grid size-9 cursor-pointer place-items-center rounded-full bg-slate-100 text-lg text-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              ×
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {isKo
              ? "안쪽 화면에서 열었지만 앱 전체 위에 나타납니다. 뒤의 헤더까지 함께 어두워지는지 보세요."
              : "Opened from the inner screen, this panel covers the entire app, including its header."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-bold">
            <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200">
              {isKo ? "안쪽 화면 유지" : "Inner state kept"}
            </span>
            <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
              {isKo ? "앱 헤더 덮기" : "Outer chrome covered"}
            </span>
          </div>
        </section>
      </div>
    </Layer>
  );
}

export default CompositionCommandLayer;
