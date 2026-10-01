"use client";

import { Screen, useNavigate } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import Stage from "../../_components/Stage";
import CompositionRouter from "../../_router/CompositionRouter";

function CompositionPlaygroundScreen() {
  const isKo = useShellLang() === "ko";
  const navigate = useNavigate();
  const openPlayground = () =>
    navigate.push("/playground", {}, { transitionName: "shared-axis-backward" });

  const steps = isKo
    ? ["보라색 카드를 열고 돌아오기", "앱 안의 필터 열기", "화면 위에 패널 띄우기"]
    : [
        "Open the purple card and go back",
        "Open the in-app filters",
        "Show a panel above the screen"
      ];

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <div className="h-full overflow-y-auto">
        <main className="playground-page">
          <div className="site-container">
            <p className="site-overline">{isKo ? "두 번째 앱" : "A second live app"}</p>
            <div className="playground-heading">
              <h1 className="site-display-section">
                {isKo
                  ? "한 앱의 여러 화면이 함께 움직입니다."
                  : "Watch the whole app move together."}
              </h1>
              <p className="site-lead">
                {isKo
                  ? "카드를 열고, 필터를 바꾸고, 패널을 띄워보세요. 어떤 화면이 움직이고 어떤 화면이 남는지 직접 확인할 수 있어요."
                  : "Open a card, change filters, and show a panel. See which part moves and which part stays put."}
              </p>
            </div>

            <div className="playground-workspace">
              <div className="playground-controls composition-guide">
                <p className="site-overline">{isKo ? "직접 해볼 것" : "Three things to try"}</p>
                <ol>
                  {steps.map((step, index) => (
                    <li key={step}>
                      <span>0{index + 1}</span>
                      <strong>{step}</strong>
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={openPlayground} className="site-text-link mt-9">
                  {isKo ? "다른 움직임도 비교하기" : "Compare other movements"} ↗
                </button>
              </div>

              <div className="playground-preview">
                <div className="playground-preview-caption">
                  <span className="home-lab-live-dot" aria-hidden="true" />
                  {isKo ? "직접 조작할 수 있는 앱" : "Interactive app"}
                </div>
                <Stage>
                  <CompositionRouter />
                </Stage>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Screen>
  );
}

export default CompositionPlaygroundScreen;
