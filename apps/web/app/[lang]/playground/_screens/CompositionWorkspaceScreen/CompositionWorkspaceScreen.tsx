"use client";

import { Route, Router, Screen, Slot, useNavigate } from "@flemo/react";

import CompositionHeader from "../../_components/CompositionHeader";
import CompositionStoryCard from "../../_components/CompositionStoryCard";
import CompositionFiltersScreen from "../CompositionFiltersScreen";
import CompositionListScreen from "../CompositionListScreen";

function CompositionWorkspaceScreen() {
  const app = useNavigate({ router: "composition-app" });

  return (
    <Screen
      hideStatusBar
      hideSystemNavigationBar
      backgroundColor="var(--color-bg)"
      sharedTopBar={
        <CompositionHeader
          eyebrow="Workspace"
          title="Inbox"
          action={
            <button
              type="button"
              aria-label="Open menu"
              className="grid size-full cursor-pointer place-items-center text-white"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M4 5.5h10M4 9h10M4 12.5h10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          }
        />
      }
      sharedTopBarId="composition-app-header"
      contentScrollable={false}
    >
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
        <button
          type="button"
          onClick={() => app.push("/composition-detail/:id", { id: "42" })}
          data-testid="composition-featured"
          className="block w-full cursor-pointer text-left"
        >
          <CompositionStoryCard paired variant="preview" />
        </button>

        <div className="min-h-[238px] flex-1 overflow-hidden rounded-[24px] border border-black/6 bg-slate-100 dark:border-white/8 dark:bg-slate-900/60">
          <div className="flex h-10 items-center justify-between border-b border-black/5 px-3 dark:border-white/8">
            <span className="text-[10px] font-extrabold tracking-[0.16em] text-slate-400 uppercase">
              Nested memory Router
            </span>
            <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-300">
              LOCAL
            </span>
          </div>
          <Router
            name="composition-pane"
            history="memory"
            initPath="/composition-pane-list"
            className="h-[calc(100%_-_2.5rem)] w-full"
          >
            <Slot className="h-full w-full">
              <Route path="/composition-pane-list" element={<CompositionListScreen />} />
              <Route path="/composition-pane-filters" element={<CompositionFiltersScreen />} />
            </Slot>
          </Router>
        </div>
      </div>
    </Screen>
  );
}

export default CompositionWorkspaceScreen;
