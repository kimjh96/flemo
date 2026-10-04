import type { LocalizedDocPage } from "../docTypes";

const slotCode = `<Router>
  <Header />
  <Slot className="h-full w-full">
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
  </Slot>
</Router>`;

const page: LocalizedDocPage = {
  en: {
    slug: "slot",
    title: "Slot",
    summary:
      "`Slot` marks where screens render inside your layout, so the header, sidebar or tab bar around it stays mounted and still while only that region transitions.",
    blocks: [
      {
        type: "p",
        text: "A `Router` transitions the whole viewport by default. To keep a header, sidebar, or tab bar still, wrap just the routes in a `Slot`."
      },
      { type: "code", lang: "tsx", title: "App.tsx", code: slotCode, highlight: [2, 3] },
      { type: "h", text: "Give it a size" },
      {
        type: "p",
        text: 'Screens are absolutely positioned inside the Slot, so an unsized Slot can collapse to zero height. Size it with `className` or `style`, usually `className="h-full w-full"`.'
      },
      { type: "h", text: "Slot, shared bar, or nested Router" },
      {
        type: "table",
        headers: ["Use", "When"],
        rows: [
          ["`Slot`", "UI that is identical on every route and never moves"],
          [
            "Shared bar on [Screen](screen)",
            "A bar on each screen that should look like one continuous bar"
          ],
          ["Nested [Router](router)", "A region with its own stack, history mode, or name"]
        ]
      },
      {
        type: "note",
        kind: "warn",
        text: "If a `Router` has any child that is not a `Route`, wrap the routes in a `Slot` so flemo can tell screens from layout. Development warns otherwise."
      },
      {
        type: "details",
        title: "How it works",
        blocks: [
          {
            type: "list",
            items: [
              "Everything outside the Slot never slides or re-renders with a navigation. It is still one Router, one history, and one `useNavigate`, so a header or sidebar navigates the region directly.",
              "The Slot renders a `position: relative; overflow: hidden` box, and screens inside it are `position: absolute`. Ordinary screen content is clipped to the box.",
              "When no transition is running, a `position: fixed` overlay intentionally escapes the region, so a sheet or dialog can cover the surrounding shared bars. Use absolute positioning when an overlay should stay clipped to the Slot.",
              "The Router finds the Slot by walking the JSX you pass it, so the Slot may sit inside plain layout elements. A Slot rendered by another component's own output is not found.",
              "UI that is exactly the same on every route belongs outside the Slot rather than in a [Part](part).",
              "UI outside the Slot is outside any `Screen`. Read the active route there with `usePathname`. `useScreen` returns empty fields there rather than failing."
            ]
          }
        ]
      }
    ]
  },
  ko: {
    slug: "slot",
    title: "Slot",
    summary:
      "`Slot`은 레이아웃 안에서 화면이 그려질 영역을 정해요. 헤더나 탭 바 같은 바깥 UI는 마운트된 채 그대로 있고, 이 영역만 화면 전환돼요.",
    blocks: [
      {
        type: "p",
        text: "`Router`는 기본적으로 뷰포트 전체를 전환해요. 헤더, 사이드바, 탭 바를 고정해 두려면 라우트만 `Slot`으로 감싸세요."
      },
      { type: "code", lang: "tsx", title: "App.tsx", code: slotCode, highlight: [2, 3] },
      { type: "h", text: "크기 지정하기" },
      {
        type: "p",
        text: 'Slot 안의 화면은 absolute로 배치돼서, Slot에 크기를 주지 않으면 높이가 0이 될 수 있어요. `className`이나 `style`로 크기를 지정하세요. 보통은 `className="h-full w-full"`이면 돼요.'
      },
      { type: "h", text: "Slot, 공유 바, 중첩 Router 중 고르기" },
      {
        type: "table",
        headers: ["선택", "이럴 때 써요"],
        rows: [
          ["`Slot`", "모든 라우트에서 똑같고 전혀 움직이지 않는 UI"],
          ["[Screen](screen)의 공유 바", "화면마다 있지만 하나로 이어져 보여야 하는 바"],
          ["중첩 [Router](router)", "별도의 스택, 히스토리 모드, 이름이 필요한 영역"]
        ]
      },
      {
        type: "note",
        kind: "warn",
        text: "`Router`에 `Route`가 아닌 자식이 하나라도 있으면 라우트를 `Slot`으로 감싸세요. 그래야 flemo가 어떤 게 화면이고 어떤 게 레이아웃인지 구분할 수 있어요. 감싸지 않으면 개발 모드에서 경고가 떠요."
      },
      {
        type: "details",
        title: "동작 방식",
        blocks: [
          {
            type: "list",
            items: [
              "Slot 바깥 요소는 화면을 이동해도 밀려나거나 다시 렌더링되지 않아요. 그래도 Router, 히스토리, `useNavigate`는 하나라서 헤더나 사이드바에서 이 영역의 화면을 바로 이동시킬 수 있어요.",
              "Slot은 `position: relative; overflow: hidden`인 박스를 그리고, 그 안의 화면은 `position: absolute`예요. 일반 화면 콘텐츠는 이 박스를 넘어가면 잘려요.",
              "`position: fixed` 오버레이는 화면 전환 중이 아닐 때 일부러 이 영역을 벗어나요. 그래서 시트나 다이얼로그가 주변의 공유 바까지 덮을 수 있어요. 오버레이를 Slot 안에 가두려면 absolute로 배치하세요.",
              "Router는 전달받은 JSX를 훑어서 Slot을 찾아요. 그래서 Slot을 일반 레이아웃 요소 안에 넣어도 되지만, 다른 컴포넌트가 렌더링 결과로 돌려주는 Slot은 찾지 못해요.",
              "모든 라우트에서 완전히 똑같은 UI는 [Part](part)로 만들기보다 Slot 바깥에 두세요.",
              "Slot 바깥의 UI는 어떤 `Screen`에도 속하지 않아요. 여기서 현재 라우트를 알고 싶으면 `usePathname`을 쓰세요. `useScreen`은 에러를 내지 않고 빈 값을 돌려줘요."
            ]
          }
        ]
      }
    ]
  }
};

export default page;
