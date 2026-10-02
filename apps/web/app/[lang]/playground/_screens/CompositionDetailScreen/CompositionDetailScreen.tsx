"use client";

import { Screen, useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import CompositionHeader from "../../_components/CompositionHeader";
import CompositionStoryCard from "../../_components/CompositionStoryCard";

function CompositionDetailScreen() {
  const app = useNavigate({ router: "composition-app" });
  const { id } = useParams<"/composition-detail/:id">();
  const isKo = useShellLang() === "ko";

  return (
    <Screen
      hideStatusBar
      hideSystemNavigationBar
      backgroundColor="var(--color-bg)"
      sharedTopBar={
        <CompositionHeader
          eyebrow={isKo ? `메시지 ${id}` : `Message ${id}`}
          title={isKo ? "소식" : "Brief"}
          action={
            <button
              type="button"
              onClick={() => app.pop()}
              aria-label={isKo ? "작업 공간으로 돌아가기" : "Back to workspace"}
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
          <p>
            {isKo
              ? "카드와 제목이 상세 화면까지 이어집니다. 헤더도 화면과 함께 바뀝니다."
              : "The card and title carry into the detail screen while the header changes with them."}
          </p>
          <p className="mt-3 rounded-2xl bg-slate-100 p-3 text-[11px] dark:bg-slate-900">
            {isKo
              ? "왼쪽 가장자리를 천천히 밀어보세요. 화면과 뒤로 가기 버튼이 함께 움직입니다."
              : "Drag slowly from the left edge. The screen, title, and back button follow your hand."}
          </p>
        </div>
      </div>
    </Screen>
  );
}

export default CompositionDetailScreen;
