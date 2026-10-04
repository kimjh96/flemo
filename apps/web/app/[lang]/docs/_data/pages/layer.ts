import type { DocBlock, LocalizedDocPage } from "../docTypes";

const inboxCode = `import { useState } from "react";

import { Layer, Screen } from "@flemo/react";

import { ComposeSheet, MailList, TabBar } from "./ui";

export function Inbox() {
  const [open, setOpen] = useState(false);

  return (
    <Screen sharedBottomBar={<TabBar />}>
      <MailList onCompose={() => setOpen(true)} />
      <Layer>
        <ComposeSheet open={open} onClose={() => setOpen(false)} />
      </Layer>
    </Screen>
  );
}`;

const enBlocks: DocBlock[] = [
  { type: "h", text: "Wrap the overlay" },
  {
    type: "p",
    text: "Wrap the overlay in `Layer` inside the screen it belongs to, such as a bottom sheet that must dim the tab bar."
  },
  { type: "code", lang: "tsx", title: "Inbox.tsx", code: inboxCode, highlight: [13, 14, 15] },
  { type: "h", text: "What stays with the screen" },
  {
    type: "list",
    items: [
      "Only the drawing order leaves the screen. The overlay keeps its screen's stack position, status and transition, so it moves with the screen and leaves on a pop.",
      "React freezes and unmounts it with the screen.",
      "Children keep their positioning: `position: fixed; bottom: 0` works unchanged.",
      "Overlays from two screens stack in their screens' order."
    ]
  },
  { type: "h", text: "When you need it" },
  {
    type: "p",
    text: "A screen at rest has no transform, so a plain `position: fixed` overlay with its own `z-index` already covers the bars. Use `Layer` when the screen moves under the overlay, or when the overlay must cover a header or tab bar that an ancestor screen declared."
  },
  {
    type: "note",
    kind: "warn",
    text: "`Layer` renders nothing on the server and on the first client render, before its host mounts."
  },
  {
    type: "note",
    kind: "warn",
    title: "Inside a nested Router",
    text: "The host belongs to the outermost screen, so `bottom: 0` resolves against the root `Router`'s viewport-sized region, not the nested box. To stay inside the box, omit `Layer` and render ordinary content."
  },
  {
    type: "details",
    title: "Why an overlay cannot do this from inside the screen",
    blocks: [
      {
        type: "p",
        text: "A moving screen carries a transform. A transform is both the containing block for `position: fixed` descendants and a stacking context around everything inside it."
      },
      {
        type: "p",
        text: 'The shared bars live outside the screen, as its siblings. To the bars, an overlay written inside the screen is one unit with the screen\'s content, so "content under the bar, sheet over the bar" cannot be expressed at any `z-index`. `Layer` portals the overlay to a host beside the screens.'
      }
    ]
  },
  {
    type: "details",
    title: "How the layer slot behaves",
    blocks: [
      {
        type: "list",
        items: [
          "`Layer` takes only `children` (`LayerProps`).",
          "Each overlay renders into a slot that fills the host (`position: absolute; inset: 0`). The host is the root Router's region, which is fixed at full size, so `bottom: 0` resolves to the same edge during a transition and at rest, and nothing jumps when a transition starts or ends.",
          "The slot itself never takes pointer events, so an overlay that draws only a bottom sheet does not block taps above it. Your children get pointer events back.",
          "Slots stack by the depth of the screen they belong to, not by portal mount order.",
          "When a screen underneath is hidden, its overlay is hidden with it. The overlay also waits with its screen during the short pause before a transition starts.",
          "When the host belongs to the overlay's own screen, the slot does not apply the transition a second time, so the overlay never moves twice as far as its screen."
        ]
      }
    ]
  }
];

const koBlocks: DocBlock[] = [
  { type: "h", text: "오버레이 감싸기" },
  {
    type: "p",
    text: "탭 바까지 어둡게 덮어야 하는 바텀 시트처럼 공유 바 위에 떠야 하는 오버레이는, 그 오버레이를 띄우는 화면 안에서 `Layer`로 감싸세요."
  },
  { type: "code", lang: "tsx", title: "Inbox.tsx", code: inboxCode, highlight: [13, 14, 15] },
  { type: "h", text: "화면과 함께 움직이는 것" },
  {
    type: "list",
    items: [
      "화면 밖으로 나가는 건 그리는 순서뿐이에요. 오버레이는 화면의 스택 위치, status, 트랜지션을 그대로 따르기 때문에 화면과 함께 움직이고, pop하면 화면과 함께 사라져요.",
      "React에서도 화면의 일부라서, 화면이 freeze되면 함께 freeze되고 화면이 언마운트되면 함께 언마운트돼요.",
      "자식 요소의 위치 지정은 그대로예요. `position: fixed; bottom: 0`도 바꾸지 않고 쓸 수 있어요.",
      "여러 화면에서 띄운 오버레이는 화면 순서대로 쌓여요."
    ]
  },
  { type: "h", text: "언제 필요한가요" },
  {
    type: "p",
    text: "화면이 멈춰 있을 때는 transform이 없어서, `z-index`를 준 평범한 `position: fixed` 오버레이로도 공유 바를 덮을 수 있어요. `Layer`가 필요한 건 오버레이 아래에서 화면이 움직일 때, 또는 상위 화면이 선언한 헤더나 탭 바까지 덮어야 할 때예요."
  },
  {
    type: "note",
    kind: "warn",
    text: "`Layer`는 서버 렌더링과, 호스트가 마운트되기 전의 첫 클라이언트 렌더링에서는 아무것도 그리지 않아요."
  },
  {
    type: "note",
    kind: "warn",
    title: "중첩 Router 안에서",
    text: "호스트는 가장 바깥 화면에 있어서, `bottom: 0`은 중첩된 영역이 아니라 루트 `Router`의 뷰포트 크기 영역을 기준으로 계산돼요. 오버레이를 중첩된 영역 안에 두려면 `Layer`를 빼고 일반 콘텐츠로 그리세요."
  },
  {
    type: "details",
    title: "화면 안에서는 왜 안 될까요",
    blocks: [
      {
        type: "p",
        text: "움직이는 화면에는 transform이 걸려 있어요. transform이 있는 요소는 `position: fixed` 자손의 위치 기준이 되고, 안쪽 전체를 하나의 쌓임 맥락(stacking context)으로 묶어요."
      },
      {
        type: "p",
        text: '공유 바는 화면 바깥에 형제 요소로 있어요. 그래서 공유 바 입장에서는 화면 안에 쓴 오버레이와 화면 콘텐츠가 한 덩어리이고, "콘텐츠는 바 아래, 시트는 바 위" 같은 배치는 `z-index`를 어떻게 줘도 만들 수 없어요. `Layer`는 오버레이를 화면들 옆에 있는 호스트로 포털해서 이 문제를 피해요.'
      }
    ]
  },
  {
    type: "details",
    title: "레이어 슬롯 동작",
    blocks: [
      {
        type: "list",
        items: [
          "`Layer`는 `children`만 받아요(`LayerProps`).",
          "오버레이는 호스트를 가득 채우는 슬롯(`position: absolute; inset: 0`) 안에 그려져요. 호스트는 화면 전체 크기로 고정된 루트 Router 영역이라서, `bottom: 0`은 전환 중이든 멈춰 있든 같은 위치를 가리켜요. 그래서 전환이 시작하거나 끝날 때 오버레이가 튀지 않아요.",
          "슬롯 자체는 포인터 이벤트를 받지 않아요. 바텀 시트만 그리는 오버레이라도 그 위쪽 영역의 탭을 막지 않고, 자식 요소는 포인터 이벤트를 정상적으로 받아요.",
          "슬롯은 포털이 마운트된 순서가 아니라, 오버레이를 띄운 화면의 깊이 순서대로 쌓여요.",
          "뒤에 있는 화면이 숨겨지면 그 화면의 오버레이도 함께 숨겨져요. 전환이 시작되기 직전 잠깐 멈추는 구간에서도 화면과 함께 기다려요.",
          "호스트가 오버레이를 띄운 화면 자신의 것이면 슬롯에 트랜지션을 한 번 더 적용하지 않아요. 그래서 오버레이가 화면보다 두 배 멀리 움직이는 일이 없어요."
        ]
      }
    ]
  }
];

const page: LocalizedDocPage = {
  en: {
    slug: "layer",
    title: "Layer",
    summary:
      "`<Layer>` renders an overlay beside its screen instead of inside it, so a sheet can cover shared bars and stay correct while the screen moves.",
    blocks: enBlocks
  },
  ko: {
    slug: "layer",
    title: "Layer",
    summary:
      "`<Layer>`는 오버레이를 화면 안이 아니라 화면 옆에 그려요. 그래서 시트가 공유 바를 덮을 수 있고, 화면이 움직이는 동안에도 올바른 위치에 보여요.",
    blocks: koBlocks
  }
};

export default page;
