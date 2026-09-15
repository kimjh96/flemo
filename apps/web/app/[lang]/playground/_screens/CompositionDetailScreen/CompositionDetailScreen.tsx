"use client";

import { Screen, useNavigate, useParams } from "@flemo/react";

import CompositionHeader from "../../_components/CompositionHeader";
import CompositionStoryCard from "../../_components/CompositionStoryCard";

function CompositionDetailScreen() {
  const app = useNavigate({ router: "composition-app" });
  const { id } = useParams<"/composition-detail/:id">();

  return (
    <Screen
      hideStatusBar
      hideSystemNavigationBar
      backgroundColor="var(--color-bg)"
      sharedTopBar={
        <CompositionHeader
          eyebrow={`Message ${id}`}
          title="Brief"
          action={
            <button
              type="button"
              onClick={() => app.pop()}
              aria-label="Back to workspace"
              className="grid size-full cursor-pointer place-items-center text-white"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="m11 4.5-4.5 4.5 4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          }
        />
      }
      sharedTopBarId="composition-app-header"
    >
      <div data-testid="composition-detail" className="p-3">
        <CompositionStoryCard paired={id === "42"} variant="detail" />
        <div className="px-2 py-5 text-[13px] leading-6 text-slate-600 dark:text-slate-300">
          <p>The screen, shared header, title, action, and Morph settle on one root clock.</p>
          <p className="mt-3 rounded-2xl bg-slate-100 p-3 text-[11px] dark:bg-slate-900">
            Drag slowly from the left edge. No Part hooks are installed; the title and back action
            follow through the default rider.
          </p>
        </div>
      </div>
    </Screen>
  );
}

export default CompositionDetailScreen;
