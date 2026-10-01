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
        <div className="mx-auto grid min-h-full w-full max-w-[1180px] items-center gap-10 px-6 pt-24 pb-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:pt-28">
          <section className="order-2 lg:order-1">
            <p className="text-xs font-extrabold tracking-[0.18em] text-indigo-500 uppercase">
              Agent composition benchmark
            </p>
            <h1 className="mt-3 text-[clamp(1.9rem,4vw,3rem)] leading-[1.04] font-black tracking-[-0.045em] text-[var(--color-text-primary)]">
              {isKo ? "구조와 모션을 한 번에 검증하기" : "Verify structure and motion together"}
            </h1>
            <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
              {isKo
                ? "루트 공유 헤더의 타이틀과 좌측 액션은 화면 전환과 스와이프를 따라가고, 안쪽 memory Router는 자기 영역만 바꿔요. 두 스택과 Morph 소유권이 한 장면에 들어 있어요."
                : "The root shared header's title and left action follow navigation and swipe, while the inner memory Router changes only its own region. Two stacks and Morph ownership share one scene."}
            </p>
            <ol className="mt-7 grid gap-3 text-sm text-[var(--color-text-secondary)]">
              <li>
                <strong className="text-[var(--color-text-primary)]">1.</strong>{" "}
                {isKo
                  ? "Local filters를 열어 루트 헤더가 그대로인지 봅니다."
                  : "Open Local filters and confirm the root header stays still."}
              </li>
              <li>
                <strong className="text-[var(--color-text-primary)]">2.</strong>{" "}
                {isKo
                  ? "로컬 뒤로가기 뒤 보라색 카드를 열어 root Morph와 헤더 교대를 봅니다."
                  : "Go local-back, then open the purple card to watch the root Morph and header handoff."}
              </li>
              <li>
                <strong className="text-[var(--color-text-primary)]">3.</strong>{" "}
                {isKo
                  ? "안쪽 화면에서 Command layer를 열어 루트 공유 헤더까지 덮는지 봅니다."
                  : "Open Command layer inside the nested screen and confirm it covers the root shared header."}
              </li>
              <li>
                <strong className="text-[var(--color-text-primary)]">4.</strong>{" "}
                {isKo
                  ? "왼쪽 가장자리에서 천천히 끌어 취소하고, 다시 끌어 커밋합니다."
                  : "Drag slowly from the left edge, cancel once, then commit."}
              </li>
            </ol>
            <p className="mt-6 max-w-[48ch] rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4 text-xs leading-relaxed text-amber-700 dark:text-amber-200">
              {isKo
                ? "시각 판정은 실제 기기에서 DevTools와 화면 캡처를 끈 상태로 먼저 해주세요. 개발 빌드에서는 그 뒤 window.flemo.report()로 잔여 상태와 anomaly를 확인합니다."
                : "Judge visually on a real device with DevTools and capture closed. In a development build, inspect window.flemo.report() afterward for residue and anomalies."}
            </p>
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
