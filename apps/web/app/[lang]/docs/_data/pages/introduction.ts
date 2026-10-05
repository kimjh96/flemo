import type { LocalizedDocPage } from "../docTypes";

const page: LocalizedDocPage = {
  en: {
    slug: "introduction",
    title: "Introduction",
    summary:
      "flemo is a screen router for React that gives web apps a native-style stack: push a screen, pop it, or drag from the edge to go back.",
    blocks: [
      {
        type: "demo",
        demo: "cupertino",
        caption: "Tap a row to push the detail screen, then drag from the left edge to go back."
      },
      {
        type: "p",
        text: "Routing and screen transitions are one system. A push adds a real history entry and animates the new screen in. A pop shows the previous screen again."
      },
      { type: "h", text: "Five core pieces" },
      {
        type: "table",
        headers: ["Piece", "Job"],
        rows: [
          ["[`Router`](router)", "Manages the screen stack, its history, and its transitions"],
          ["[`Route`](router)", "Maps a path to one screen"],
          ["[`Screen`](screen)", "One screen: its content, top and bottom bars, and safe areas"],
          ["[`useNavigate`](navigation)", "Pushes, replaces, or pops screens"],
          [
            "[`Slot`](slot)",
            "Keeps the header and other fixed UI still while only its region moves"
          ]
        ]
      },
      { type: "h", text: "What you get by default" },
      {
        type: "list",
        items: [
          "`cupertino` (default), `material`, `layout`, and instant `none` transitions",
          "Swipe-back and drag-to-dismiss tied to real history",
          "Shared top and bottom bars that stay in place across screens",
          "Type-safe paths, params, transition names, and Router targets",
          "Custom screen, [Part](part), decorator, and [Morph](morph) motion"
        ]
      },
      { type: "h", text: "Where it fits" },
      {
        type: "note",
        kind: "warn",
        text: "flemo is a screen router that manages client-side history itself. It fits SPAs, hybrid WebViews, and self-contained app regions, not a host framework that routes the same URLs."
      },
      { type: "h", text: "Next steps" },
      {
        type: "list",
        items: [
          "[Getting started](getting-started): your first push and pop",
          "[Transitions](transitions): presets, custom motion, gestures",
          "[Part](part), [Layer](layer), [Morph](morph), [Putting it together](putting-it-together): richer motion"
        ]
      }
    ]
  },
  ko: {
    slug: "introduction",
    title: "Introduction",
    summary:
      "flemo는 웹 앱에 네이티브 같은 화면 스택을 만들어 주는 React 라우터예요. 화면을 push하고 pop하거나, 화면 가장자리를 스와이프해서 뒤로 갈 수 있어요.",
    blocks: [
      {
        type: "demo",
        demo: "cupertino",
        caption:
          "목록의 항목을 누르면 상세 화면이 push돼요. 왼쪽 가장자리에서 스와이프하면 뒤로 가요."
      },
      {
        type: "p",
        text: "flemo에서는 라우팅과 화면 전환이 하나로 묶여 있어요. push하면 브라우저 히스토리에 실제 항목이 추가되면서 새 화면이 들어오고, pop하면 이전 화면이 다시 보여요."
      },
      { type: "h", text: "핵심 구성 요소" },
      {
        type: "table",
        headers: ["구성 요소", "역할"],
        rows: [
          ["[`Router`](router)", "화면 스택과 히스토리, 화면 전환을 관리해요"],
          ["[`Route`](router)", "경로 하나를 화면 하나에 연결해요"],
          [
            "[`Screen`](screen)",
            "화면 하나를 그려요. 콘텐츠, 상단·하단 바, 세이프 에어리어를 담아요"
          ],
          ["[`useNavigate`](navigation)", "화면을 push, replace, pop해요"],
          ["[`Slot`](slot)", "헤더 같은 고정 UI는 그대로 두고 그 영역만 전환해요"]
        ]
      },
      { type: "h", text: "기본 제공 기능" },
      {
        type: "list",
        items: [
          "`cupertino`(기본값), `material`, `layout`, 애니메이션 없이 바로 바뀌는 `none` 화면 전환",
          "실제 히스토리와 연결된 스와이프 뒤로 가기와 끌어내려 닫기",
          "화면이 바뀌어도 제자리에 이어지는 공유 상단·하단 바",
          "경로, 파라미터, 트랜지션 이름, 대상 Router까지 타입 체크",
          "화면 전환, [Part](part), 데코레이터, [Morph](morph) 애니메이션 직접 만들기"
        ]
      },
      { type: "h", text: "적합한 환경" },
      {
        type: "note",
        kind: "warn",
        text: "flemo는 클라이언트 히스토리를 직접 관리하는 화면 라우터예요. SPA, 하이브리드 WebView, 독립된 앱 영역에 잘 맞아요. 같은 URL을 직접 라우팅하는 호스트 프레임워크와 함께 쓰기에는 맞지 않아요."
      },
      { type: "h", text: "다음 단계" },
      {
        type: "list",
        items: [
          "[빠르게 시작하기](getting-started): 첫 push와 pop",
          "[Transitions](transitions): 프리셋, 직접 만드는 화면 전환, 제스처",
          "[Part](part), [Layer](layer), [Morph](morph), [Putting it together](putting-it-together): 더 풍부한 애니메이션"
        ]
      }
    ]
  }
};

export default page;
