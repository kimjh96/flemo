"use client";

import { Screen } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import Stage from "../../_components/Stage";
import CompositionRouter from "../../_router/CompositionRouter";

function CompositionPlaygroundScreen() {
  const isKo = useShellLang() === "ko";

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="transparent">
      <div className="h-full overflow-y-auto">
        <div className="site-container grid min-h-full items-center gap-10 px-5 pt-32 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 lg:pt-36">
          <section className="order-2 lg:order-1">
            <span className="site-eyebrow">{isKo ? "조합 데모" : "Composition demo"}</span>
            <h1 className="mt-5 max-w-[12ch] text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.1] font-extrabold tracking-[-0.055em] text-[var(--color-text-primary)] break-keep">
              {isKo
                ? "한 화면 안의 여러 움직임, 하나의 흐름."
                : "Many moving parts. One coherent flow."}
            </h1>
            <p className="mt-6 max-w-[50ch] text-[17px] leading-[1.7] text-[var(--color-text-secondary)] break-keep">
              {isKo
                ? "카드는 상세 화면으로 이어지고 헤더는 바뀐 내용을 따라갑니다. 안쪽 목록은 자기 영역에서만 이동해요. 직접 눌러보면 차이가 보입니다."
                : "The card carries into its detail screen as the header changes with it. The inner list moves within its own space. Try each action to see how they work together."}
            </p>
            <ol className="mt-9 grid gap-3 text-[15px] leading-[1.6] text-[var(--color-text-secondary)]">
              <li>
                <span className="mr-3 font-semibold text-[var(--color-primary)]">01</span>
                {isKo
                  ? "보라색 카드를 열고 뒤로 돌아오세요."
                  : "Open the purple card, then go back."}
              </li>
              <li>
                <span className="mr-3 font-semibold text-[var(--color-primary)]">02</span>
                {isKo
                  ? "Local filters를 열어 헤더가 제자리에 남는지 보세요."
                  : "Open Local filters and watch the header stay in place."}
              </li>
              <li>
                <span className="mr-3 font-semibold text-[var(--color-primary)]">03</span>
                {isKo
                  ? "Command layer를 열어 화면 위로 올라오는 패널을 보세요."
                  : "Open Command layer to see a panel rise above the screen."}
              </li>
            </ol>
            <div className="mt-10 flex flex-wrap gap-2">
              {["Morph", "Part", "Layer", "Nested Router"].map((feature) => (
                <span key={feature} className="chip">
                  {feature}
                </span>
              ))}
            </div>
          </section>

          <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
            <Stage>
              <CompositionRouter />
            </Stage>
          </div>
        </div>
      </div>
    </Screen>
  );
}

export default CompositionPlaygroundScreen;
