import type { LocalizedDocPage } from "../docTypes";

const DIM_EN = `import { createDecorator, createTransition } from "@flemo/react";

const DIM = "rgba(0, 0, 0, 0.4)";

// No durations: every variant uses the timing of the transition that sets it.
export const dim = createDecorator({
  name: "dim",
  initial: { opacity: 0, backgroundColor: DIM },
  idle: { value: { opacity: 0, backgroundColor: DIM } },
  enter: { value: { opacity: 1, backgroundColor: DIM } },
  exit: { value: { opacity: 0, backgroundColor: DIM } }
});

export const dive = createTransition({
  name: "dive",
  initial: { y: "100%" },
  idle: { value: { y: 0 }, options: { duration: 0 } },
  enter: { value: { y: 0 }, options: { duration: 0.4, ease: "ease-out" } },
  exit: { value: { scale: 0.94 }, options: { duration: 0.4, ease: "ease-out" } },
  enterBack: { value: { y: "100%" }, options: { duration: 0.3, ease: "ease-in" } },
  exitBack: { value: { scale: 1 }, options: { duration: 0.3, ease: "ease-in" } },
  options: { decoratorName: "dim" }
});

declare module "@flemo/react" {
  interface RegisterDecorator {
    dim: "dim";
  }
  interface RegisterTransition {
    dive: "dive";
  }
}`;

const DIM_KO = `import { createDecorator, createTransition } from "@flemo/react";

const DIM = "rgba(0, 0, 0, 0.4)";

// duration 없음: 모든 variant가 이 데코레이터를 지정한 트랜지션의 타이밍을 따라요
export const dim = createDecorator({
  name: "dim",
  initial: { opacity: 0, backgroundColor: DIM },
  idle: { value: { opacity: 0, backgroundColor: DIM } },
  enter: { value: { opacity: 1, backgroundColor: DIM } },
  exit: { value: { opacity: 0, backgroundColor: DIM } }
});

export const dive = createTransition({
  name: "dive",
  initial: { y: "100%" },
  idle: { value: { y: 0 }, options: { duration: 0 } },
  enter: { value: { y: 0 }, options: { duration: 0.4, ease: "ease-out" } },
  exit: { value: { scale: 0.94 }, options: { duration: 0.4, ease: "ease-out" } },
  enterBack: { value: { y: "100%" }, options: { duration: 0.3, ease: "ease-in" } },
  exitBack: { value: { scale: 1 }, options: { duration: 0.3, ease: "ease-in" } },
  options: { decoratorName: "dim" }
});

declare module "@flemo/react" {
  interface RegisterDecorator {
    dim: "dim";
  }
  interface RegisterTransition {
    dive: "dive";
  }
}`;

const DIM_ROUTER = `<Router transitions={[dive]} decorators={[dim]}>
  <Route path="/" element={<Home />} />
</Router>`;

const page: LocalizedDocPage = {
  en: {
    slug: "decorator",
    title: "Decorator",
    summary:
      "A decorator dims or tints the previous screen during a transition. It uses that transition's timing and follows a swipe back without any code.",
    blocks: [
      {
        type: "demo",
        demo: "cupertino",
        caption:
          "Open a place and drag from the left edge: the dim over the list follows your finger and keeps fading after you let go."
      },
      { type: "h", text: "What a decorator is" },
      {
        type: "p",
        text: "A decorator is a layer flemo puts over the INACTIVE side of a screen transition: the previous screen, moving behind on a push or coming back on a pop. It is not an element you render. A transition sets it with `options.decoratorName`, and the Router that runs that transition registers it."
      },
      {
        type: "p",
        text: "Use one for depth that belongs to the navigation itself, such as a dim behind a sheet. A shadow or overlay that belongs to one screen's content is a [Part](part) or ordinary markup instead."
      },
      { type: "h", text: "The built-in overlay" },
      {
        type: "p",
        text: "`cupertino` sets `overlay`, a 10% black dim (`rgba(0, 0, 0, 0.1)`) that only animates `opacity`. `material`, `layout` and `none` set no decorator."
      },
      {
        type: "list",
        items: [
          "It sets no durations, so it runs in step with whichever transition uses it, at any length",
          "It leaves its easing unwritten: a decelerating curve made for movement would do most of the darkening at once, so the default ease spreads the dim evenly",
          "Holding `backgroundColor` fixed and animating only `opacity` keeps it on the compositor on every browser"
        ]
      },
      { type: "h", text: "Writing a decorator" },
      {
        type: "table",
        headers: ["Slot", "Applies to"],
        rows: [
          ["`initial`", "The starting style on a newly mounted screen"],
          [
            "`idle`",
            "The active screen, including the top screen closing on pop. Normally invisible"
          ],
          ["`enter`", "The screen moving into, or staying in, the background"],
          ["`exit`", "The screen coming back on pop. Animates from `enter`; match it to `idle`"]
        ]
      },
      {
        type: "code",
        lang: "ts",
        title: "transitions/dive.ts",
        code: DIM_EN,
        highlight: [9, 10, 11, 22]
      },
      { type: "code", lang: "tsx", code: DIM_ROUTER },
      {
        type: "note",
        kind: "tip",
        text: "Leave `duration` out. A decorator inherits duration and delay from the transition that sets it, variant by variant. `ease` never inherits: a curve drawn for movement is wrong for a fade."
      },
      { type: "h", text: "Timing" },
      {
        type: "list",
        items: [
          "Each decorator variant takes its timing from the screen variant that runs at the same moment. A decorator's `enter` runs with the screen's `exit`, and its `exit` with the screen's `exitBack`",
          "Asymmetric transitions pass their asymmetry on. Under `material`, a dim runs 0.35s on push and 0.25s on pop",
          "An explicit `duration` wins, including `0` to change at once. Resolution uses `??`, so an authored `0` survives",
          "A decorator has no `dismiss`. It covers the previous screen of one transition, and the closing screen is not that screen"
        ]
      },
      {
        type: "note",
        kind: "warn",
        text: "A literal duration longer than the screen's leaves a grey cast still fading on a screen that has already stopped. Inheriting avoids it."
      },
      { type: "h", text: "Swipe" },
      {
        type: "p",
        text: "A decorator that declares only variant values follows a swipe back by itself. During the drag it shows the style the transition would give it at the same point of the screen's movement, read through the screen's easing and then its own. When the finger lifts, it plays the rest of the same motion: to the end if the swipe goes back, or back to where it started if the swipe is cancelled."
      },
      {
        type: "note",
        kind: "warn",
        text: "Writing `onSwipe` or `onSwipeStart` makes the decorator handle its own drag and turns that default off. Add hooks only for a gesture shape the declared variants cannot express, never just to make the dim track the finger."
      },
      {
        type: "details",
        title: "Hooks and raw decorators",
        blocks: [
          {
            type: "list",
            items: [
              "Decorator hooks receive `(triggered, { animate, currentDecorator, prevDecorator })`. `onSwipe` also receives progress from 0 to 100",
              "`onSwipeEnd` alone does not turn the default off; `onSwipe` and `onSwipeStart` do",
              "`createRawDecorator` takes the ten raw slots of `createRawTransition`, with the same inheritance, for push, replace and pop styles that differ"
            ]
          }
        ]
      }
    ]
  },
  ko: {
    slug: "decorator",
    title: "Decorator",
    summary:
      "데코레이터는 화면 전환 중에 이전 화면을 어둡게 하거나 색을 덮어요. 트랜지션과 같은 타이밍으로 움직이고, 코드 없이도 스와이프 뒤로 가기를 따라가요.",
    blocks: [
      {
        type: "demo",
        demo: "cupertino",
        caption:
          "장소를 하나 열고 왼쪽 가장자리에서 끌어 보세요. 목록 위의 딤이 손가락을 따라가고, 손을 뗀 뒤에도 이어서 옅어져요."
      },
      { type: "h", text: "데코레이터란" },
      {
        type: "p",
        text: "데코레이터는 화면 전환 중에 flemo가 비활성 화면 위에 까는 레이어예요. 비활성 화면은 push할 때 뒤로 가려지는 화면, pop할 때 다시 나타나는 화면을 말해요. 직접 렌더링하는 요소가 아니고, 트랜지션의 `options.decoratorName`으로 지정한 뒤 그 트랜지션을 쓰는 Router에 등록해요."
      },
      {
        type: "p",
        text: "시트 뒤의 딤처럼 화면 이동 자체에서 생기는 깊이감에 쓰세요. 한 화면의 콘텐츠에 속한 그림자나 오버레이라면 [Part](part)나 일반 마크업으로 만드는 게 맞아요."
      },
      { type: "h", text: "내장 overlay" },
      {
        type: "p",
        text: "`cupertino`는 `overlay`를 지정해요. 10% 검정(`rgba(0, 0, 0, 0.1)`) 딤이고 `opacity`만 애니메이션해요. `material`, `layout`, `none`은 데코레이터를 쓰지 않아요."
      },
      {
        type: "list",
        items: [
          "duration을 적지 않아서, 트랜지션 길이가 얼마든 화면 전환과 함께 시작하고 함께 끝나요",
          "easing도 적지 않아요. 위치 이동용 감속 곡선을 쓰면 초반에 한꺼번에 어두워져서, 기본 ease로 고르게 어두워지게 했어요",
          "`backgroundColor`는 고정하고 `opacity`만 바꿔서, 모든 브라우저에서 컴포지터만으로 애니메이션돼요"
        ]
      },
      { type: "h", text: "데코레이터 만들기" },
      {
        type: "table",
        headers: ["슬롯", "적용 대상"],
        rows: [
          ["`initial`", "새로 마운트된 화면의 시작 스타일"],
          ["`idle`", "활성 화면. pop으로 닫히는 맨 위 화면도 포함해요. 보통은 보이지 않게 둬요"],
          ["`enter`", "뒤로 가려지는 중이거나 뒤에 머물러 있는 화면"],
          [
            "`exit`",
            "pop으로 다시 나타나는 화면. `enter`에서 시작하니 `idle`과 같은 값으로 맞추세요"
          ]
        ]
      },
      {
        type: "code",
        lang: "ts",
        title: "transitions/dive.ts",
        code: DIM_KO,
        highlight: [9, 10, 11, 22]
      },
      { type: "code", lang: "tsx", code: DIM_ROUTER },
      {
        type: "note",
        kind: "tip",
        text: "`duration`은 적지 마세요. 데코레이터는 자신을 지정한 트랜지션의 duration과 delay를 variant별로 그대로 따라요. `ease`는 따르지 않아요. 위치 이동에 맞춘 곡선은 페이드에 어울리지 않기 때문이에요."
      },
      { type: "h", text: "타이밍" },
      {
        type: "list",
        items: [
          "데코레이터의 각 variant는 같은 순간에 움직이는 화면 variant의 타이밍을 따라요. 데코레이터의 `enter`는 화면의 `exit`과, `exit`은 화면의 `exitBack`과 함께 움직여요",
          "push와 pop의 길이가 다른 트랜지션이면 데코레이터도 똑같이 달라져요. `material`에서는 딤이 push에 0.35초, pop에 0.25초 동안 움직여요",
          "`duration`을 직접 적으면 그 값이 우선해요. `0`을 적어 바로 바뀌게 할 수도 있어요. 값을 `??`로 정하기 때문에 직접 적은 `0`도 그대로 적용돼요",
          "데코레이터에는 `dismiss`가 없어요. 데코레이터는 트랜지션의 이전 화면을 덮는데, 닫히는 화면은 그 대상이 아니기 때문이에요"
        ]
      },
      {
        type: "note",
        kind: "warn",
        text: "화면보다 긴 duration을 직접 적으면, 화면은 이미 멈췄는데 회색 막이 뒤늦게 걷혀요. duration을 적지 않고 트랜지션을 따르게 하면 이런 일이 없어요."
      },
      { type: "h", text: "스와이프" },
      {
        type: "p",
        text: "variant 값만 선언한 데코레이터는 스와이프 뒤로 가기를 알아서 따라가요. 드래그하는 동안에는 화면이 같은 위치에 있을 때 화면 전환이 보여 줄 스타일을 그대로 보여 주는데, 화면의 easing과 데코레이터 자신의 easing을 차례로 거쳐 계산해요. 손을 떼면 같은 움직임의 나머지를 재생해서, 뒤로 가기가 확정되면 끝까지 가고 취소되면 처음 상태로 돌아가요."
      },
      {
        type: "note",
        kind: "warn",
        text: "`onSwipe`나 `onSwipeStart`를 적으면 데코레이터가 드래그를 직접 처리하고 이 기본 동작은 꺼져요. 선언한 variant로 표현할 수 없는 제스처일 때만 훅을 쓰세요. 딤이 손가락을 따라가게 하려는 것뿐이라면 훅은 필요 없어요."
      },
      {
        type: "details",
        title: "훅과 raw 데코레이터",
        blocks: [
          {
            type: "list",
            items: [
              "데코레이터 훅은 `(triggered, { animate, currentDecorator, prevDecorator })`를 받아요. `onSwipe`는 0~100 범위의 진행도도 함께 받아요",
              "`onSwipeEnd`만 적으면 기본 동작이 그대로 유지돼요. 기본 동작이 꺼지는 건 `onSwipe`나 `onSwipeStart`를 적었을 때예요",
              "`createRawDecorator`는 `createRawTransition`과 같은 raw 슬롯 열 개를 받고, 타이밍을 따르는 규칙도 같아요. push, replace, pop마다 스타일을 다르게 하고 싶을 때 써요"
            ]
          }
        ]
      }
    ]
  }
};

export default page;
