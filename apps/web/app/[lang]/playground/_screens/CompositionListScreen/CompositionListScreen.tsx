"use client";

import { useState } from "react";

import { Screen, useNavigate } from "@flemo/react";

import CompositionCommandLayer from "../../_components/CompositionCommandLayer";

function CompositionListScreen() {
  const pane = useNavigate();
  const app = useNavigate({ router: "composition-app" });
  const [isLayerOpen, setIsLayerOpen] = useState(false);

  return (
    <Screen
      hideStatusBar
      hideSystemNavigationBar
      backgroundColor="transparent"
      contentScrollable={false}
    >
      <div data-testid="composition-pane-list" className="grid gap-2 p-3">
        <button
          type="button"
          onClick={() => pane.push("/composition-pane-filters", {})}
          className="flex cursor-pointer items-center justify-between rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/8"
        >
          <span>
            <strong className="block text-[13px] text-slate-900 dark:text-white">
              Local filters
            </strong>
            <span className="text-[11px] text-slate-500">Push only the inner pane</span>
          </span>
          <span className="text-indigo-500">→</span>
        </button>
        <button
          type="button"
          onClick={() => app.push("/composition-detail/:id", { id: "7" })}
          className="flex cursor-pointer items-center justify-between rounded-2xl bg-indigo-500 p-3 text-left text-white shadow-lg shadow-indigo-500/20"
        >
          <span>
            <strong className="block text-[13px]">Open from nested pane</strong>
            <span className="text-[11px] text-white/75">Target the ancestor app Router</span>
          </span>
          <span>↗</span>
        </button>
        <button
          type="button"
          onClick={() => setIsLayerOpen(true)}
          className="flex cursor-pointer items-center justify-between rounded-2xl bg-slate-900 p-3 text-left text-white shadow-lg shadow-slate-950/15 dark:bg-white dark:text-slate-950"
        >
          <span>
            <strong className="block text-[13px]">Open command layer</strong>
            <span className="text-[11px] opacity-65">Cover the root shared header</span>
          </span>
          <span>⌘</span>
        </button>
        {isLayerOpen && <CompositionCommandLayer onClose={() => setIsLayerOpen(false)} />}
      </div>
    </Screen>
  );
}

export default CompositionListScreen;
