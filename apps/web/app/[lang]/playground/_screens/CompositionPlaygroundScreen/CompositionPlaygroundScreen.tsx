"use client";

import { Screen } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import Stage from "../../_components/Stage";
import CompositionRouter from "../../_router/CompositionRouter";

function CompositionPlaygroundScreen() {
  const isKo = useShellLang() === "ko";

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--bg)">
      <div className="h-full overflow-y-auto pt-14">
        <div className="mx-auto grid min-h-full w-full max-w-[1280px] items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <section className="order-2 lg:order-1">
            <p className="label flex items-center gap-2 text-fg-subtle">
              <span aria-hidden="true" className="h-px w-4 bg-accent" />
              Agent composition benchmark
            </p>
            <h1 className="mt-4 max-w-[18ch] text-h1 text-fg">
              {isKo ? "구조와 모션을 한 화면에서 확인하기" : "Verify structure and motion together"}
            </h1>
            <p className="mt-5 max-w-[52ch] text-lead text-fg-muted">
              {isKo
                ? "루트 공유 헤더의 제목과 왼쪽 버튼은 화면 전환과 스와이프를 따라 움직이고, 안쪽 memory Router는 자기 영역만 바꿔요. 스택 두 개와 각 Router의 Morph가 한 화면에 함께 있어요."
                : "The root shared header's title and left button follow navigation and swipe, while the inner memory Router changes only its own area. Two stacks, each with its own Morphs, share one screen."}
            </p>
            <ol className="mt-8 grid gap-3 border-l border-line pl-5 text-sm text-fg-muted">
              <li>
                <strong className="font-mono font-medium text-accent">1.</strong>{" "}
                {isKo
                  ? "Local filters를 열고 루트 헤더가 그대로 있는지 확인해요."
                  : "Open Local filters and confirm the root header stays still."}
              </li>
              <li>
                <strong className="font-mono font-medium text-accent">2.</strong>{" "}
                {isKo
                  ? "Local back으로 돌아간 뒤 보라색 카드를 열고, 루트 Morph와 헤더 제목이 함께 바뀌는지 확인해요."
                  : "Press Local back, then open the purple card and watch the root Morph and the header title change together."}
              </li>
              <li>
                <strong className="font-mono font-medium text-accent">3.</strong>{" "}
                {isKo
                  ? "안쪽 화면에서 Command layer를 열고 루트 공유 헤더까지 덮는지 확인해요."
                  : "Open Command layer inside the nested screen and confirm it covers the root shared header."}
              </li>
              <li>
                <strong className="font-mono font-medium text-accent">4.</strong>{" "}
                {isKo
                  ? "왼쪽 가장자리에서 천천히 스와이프하다가 한 번 취소하고, 다시 스와이프해서 뒤로 가기를 확정해요."
                  : "Swipe slowly from the left edge and cancel once, then swipe again and let it go back."}
              </li>
            </ol>
            <p className="mt-8 max-w-[52ch] rounded-lg border border-line bg-bg-subtle p-4 text-xs leading-relaxed text-fg-muted">
              {isKo
                ? "먼저 실제 기기에서 DevTools와 화면 녹화를 끈 상태로 눈으로 확인해 주세요. 그다음 개발 빌드에서 window.flemo.report()를 실행해 남은 상태와 이상 징후가 없는지 확인해요."
                : "Check by eye first, on a real device with DevTools and screen recording closed. Then, in a development build, run window.flemo.report() to look for leftover state and problems."}
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
