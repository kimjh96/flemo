import type { LocalizedDocPage } from "../docTypes";

const basicCode = `import { Screen } from "@flemo/react";

export default function Inbox() {
  return (
    <Screen topBar={<TopBar title="Inbox" />} sharedBottomBar={<TabBar />}>
      <MailList />
    </Screen>
  );
}`;

const sharedIdCode = `<Screen sharedBottomBar={<TabBar />} sharedBottomBarId="main-tabs" />

<Screen sharedBottomBar={<BuilderActions />} sharedBottomBarId="pattern-builder-actions" />`;

const safeAreaCode = `<Screen
  statusBarHeight="env(safe-area-inset-top)"
  systemNavigationBarHeight="env(safe-area-inset-bottom)"
>
  ...
</Screen>`;

const page: LocalizedDocPage = {
  en: {
    slug: "screen",
    title: "Screen",
    summary:
      "`Screen` is what every route renders: the screen's surface, its top and bottom bars, and its safe-area insets.",
    blocks: [
      { type: "code", lang: "tsx", title: "Inbox.tsx", code: basicCode, highlight: [5] },
      { type: "h", text: "Bars that move or stay" },
      {
        type: "table",
        headers: ["Props", "Rendered", "When the screen changes"],
        rows: [
          [
            "`topBar` / `bottomBar`",
            "Inside the screen box",
            "Moves with its screen, never stays still"
          ],
          [
            "`sharedTopBar` / `sharedBottomBar`",
            "Beside the screen box",
            "Stays in place if both screens have a matching bar"
          ]
        ]
      },
      {
        type: "p",
        text: "Use a shared bar for global UI like a tab bar, so it does not animate on every push."
      },
      { type: "h", text: "Matching shared bars" },
      {
        type: "p",
        text: "Label bars with `sharedTopBarId` or `sharedBottomBarId` when one position serves different roles. Only bars with equal IDs stay in place during the transition."
      },
      { type: "code", lang: "tsx", code: sharedIdCode },
      {
        type: "note",
        kind: "tip",
        text: "Use a [Slot](slot) for UI that is identical on every screen. Use a shared bar when each screen has its own bar that should still look continuous."
      },
      { type: "h", text: "Safe areas" },
      {
        type: "p",
        text: "`Screen` reserves the top and bottom safe areas itself. In a hybrid WebView, turn off native safe-area handling and let the web handle the insets."
      },
      { type: "code", lang: "tsx", code: safeAreaCode, highlight: [2, 3] },
      {
        type: "p",
        text: "The safe-area strips then move and change color with the screen, instead of content sliding under static native bars."
      },
      { type: "h", text: "Props" },
      {
        type: "table",
        headers: ["Prop", "Type", "Default"],
        rows: [
          ["`topBar` / `bottomBar`", "`ReactNode`", "none"],
          ["`sharedTopBar` / `sharedBottomBar`", "`ReactNode`", "none"],
          ["`sharedTopBarId` / `sharedBottomBarId`", "`string | number`", "none"],
          ["`backgroundColor`", "`string`", "`white`"],
          ["`statusBarHeight` / `statusBarColor`", "`string`", "none"],
          ["`systemNavigationBarHeight` / `systemNavigationBarColor`", "`string`", "none"],
          ["`hideStatusBar` / `hideSystemNavigationBar`", "`boolean`", "`false`"],
          ["`contentScrollable`", "`boolean`", "`true`"]
        ]
      },
      {
        type: "note",
        kind: "warn",
        text: "A moving screen has a transform, so even `position: fixed` children are trapped in it. Put overlays that must cover the bars in a [Layer](layer)."
      },
      {
        type: "details",
        title: "How it works",
        blocks: [
          { type: "h3", text: "Shared bar matching" },
          {
            type: "list",
            items: [
              "Two bars stay in place only when their IDs are equal. Otherwise each bar enters and leaves with its own screen.",
              "Two unlabelled bars still match by position, the legacy behavior.",
              "A labelled bar never matches an unlabelled one."
            ]
          },
          { type: "h3", text: "Props in detail" },
          {
            type: "list",
            items: [
              "`statusBarHeight` and `systemNavigationBarHeight` reserve space above the top bar and below the bottom bar. The `*Color` props fill those areas, and `hide*` removes them for one screen.",
              "`backgroundColor` is the screen's own surface. flemo checks the computed color. When it is verifiably opaque, the other screen in the transition can wait at its end position, hidden behind this one, before the motion starts. Otherwise it waits paused at its start. A transparent screen gives that up.",
              "`contentScrollable={false}` scrolls the whole screen box, bars included, instead of only the content area.",
              "A screen also creates a stacking context while it moves. Wrap elements that move on their own inside it in a [Part](part).",
              "`Screen` also accepts ordinary `div` props, except the pointer handlers (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`)."
            ]
          },
          { type: "h3", text: "Content and the transition" },
          {
            type: "p",
            text: "A newly mounting screen renders its `children` in the same commit as the screen box, and the transition starts from the first frame where they are drawn. What slides in is your real content, never an empty shell. A heavy first render delays the start, but the animation always plays in full. It is never cut short or skipped."
          },
          { type: "h3", text: "Covered screens" },
          {
            type: "p",
            text: "A covered screen stays mounted and keeps its DOM state, such as scroll position and form values. flemo stops drawing it at once and hides it with React's `Activity`, sometimes after a short delay, so its effects unmount while covered and mount again when a pop reveals it."
          }
        ]
      }
    ]
  },
  ko: {
    slug: "screen",
    title: "Screen",
    summary:
      "`Screen`은 모든 라우트가 렌더링하는 화면 컴포넌트예요. 화면 영역과 상단·하단 바, 세이프 에어리어 여백을 맡아요.",
    blocks: [
      { type: "code", lang: "tsx", title: "Inbox.tsx", code: basicCode, highlight: [5] },
      { type: "h", text: "움직이는 바와 고정 바" },
      {
        type: "table",
        headers: ["Props", "렌더링 위치", "화면이 바뀔 때"],
        rows: [
          ["`topBar` / `bottomBar`", "화면 박스 안", "항상 화면과 함께 움직여요"],
          [
            "`sharedTopBar` / `sharedBottomBar`",
            "화면 박스 옆",
            "두 화면에 짝이 되는 바가 있으면 제자리에 그대로 있어요"
          ]
        ]
      },
      {
        type: "p",
        text: "탭 바처럼 앱 전체에서 쓰는 UI는 공유 바로 만드세요. 그래야 push할 때마다 같이 움직이지 않아요."
      },
      { type: "h", text: "공유 바 짝 맞추기" },
      {
        type: "p",
        text: "같은 자리의 바가 화면마다 다른 역할을 한다면 `sharedTopBarId`나 `sharedBottomBarId`로 구분해 주세요. ID가 같은 바끼리만 화면 전환 중에 제자리에 남아요."
      },
      { type: "code", lang: "tsx", code: sharedIdCode },
      {
        type: "note",
        kind: "tip",
        text: "모든 화면에서 똑같은 UI는 [Slot](slot)에 두세요. 화면마다 바가 따로 있지만 끊김 없이 이어져 보여야 한다면 공유 바를 쓰세요."
      },
      { type: "h", text: "세이프 에어리어" },
      {
        type: "p",
        text: "`Screen`이 위아래 세이프 에어리어 공간을 직접 확보해요. 하이브리드 WebView라면 네이티브 쪽 세이프 에어리어 처리는 끄고, 여백은 웹에서 처리하세요."
      },
      { type: "code", lang: "tsx", code: safeAreaCode, highlight: [2, 3] },
      {
        type: "p",
        text: "이렇게 하면 여백 영역도 화면과 함께 움직이고 화면마다 색이 바뀌어요. 고정된 네이티브 바 아래로 콘텐츠가 밀려 들어가는 일도 없어요."
      },
      { type: "h", text: "Props" },
      {
        type: "table",
        headers: ["Prop", "타입", "기본값"],
        rows: [
          ["`topBar` / `bottomBar`", "`ReactNode`", "없음"],
          ["`sharedTopBar` / `sharedBottomBar`", "`ReactNode`", "없음"],
          ["`sharedTopBarId` / `sharedBottomBarId`", "`string | number`", "없음"],
          ["`backgroundColor`", "`string`", "`white`"],
          ["`statusBarHeight` / `statusBarColor`", "`string`", "없음"],
          ["`systemNavigationBarHeight` / `systemNavigationBarColor`", "`string`", "없음"],
          ["`hideStatusBar` / `hideSystemNavigationBar`", "`boolean`", "`false`"],
          ["`contentScrollable`", "`boolean`", "`true`"]
        ]
      },
      {
        type: "note",
        kind: "warn",
        text: "움직이는 화면에는 transform이 걸려 있어서 `position: fixed`인 자식도 화면 안에 갇혀요. 바까지 덮어야 하는 오버레이는 [Layer](layer)에 넣으세요."
      },
      {
        type: "details",
        title: "동작 원리",
        blocks: [
          { type: "h3", text: "공유 바 매칭" },
          {
            type: "list",
            items: [
              "두 바는 ID가 같을 때만 제자리에 남아요. ID가 다르면 각 바가 자기 화면과 함께 들어오고 나가요.",
              "ID가 없는 바끼리는 예전 방식대로 위치만 보고 짝을 지어요.",
              "ID가 있는 바는 ID가 없는 바와 짝이 되지 않아요."
            ]
          },
          { type: "h3", text: "Props 자세히" },
          {
            type: "list",
            items: [
              "`statusBarHeight`와 `systemNavigationBarHeight`는 상단 바 위와 하단 바 아래에 공간을 확보해요. `*Color` props로 그 영역의 색을 채우고, `hide*`로 해당 화면에서만 그 영역을 없앨 수 있어요.",
              "`backgroundColor`는 화면 자체의 배경색이에요. flemo는 계산된 배경색을 확인해서, 확실히 불투명하면 애니메이션이 시작되기 전에 상대 화면을 이 화면 뒤에 숨긴 채 끝 위치에 미리 둬요. 그렇지 않으면 상대 화면은 시작 위치에서 멈춘 채 기다려요. 배경이 투명하면 이 준비를 할 수 없어요.",
              "`contentScrollable={false}`면 콘텐츠 영역만이 아니라 바를 포함한 화면 박스 전체가 스크롤돼요.",
              "화면은 움직이는 동안 쌓임 맥락(stacking context)도 만들어요. 화면 안에서 따로 움직여야 하는 요소는 [Part](part)로 감싸세요.",
              "`Screen`은 일반 `div` props도 받아요. 단, 포인터 핸들러(`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`)는 받지 않아요."
            ]
          },
          { type: "h3", text: "콘텐츠와 화면 전환" },
          {
            type: "p",
            text: "새로 마운트되는 화면은 `children`을 화면 박스와 같은 커밋에서 렌더링하고, 화면 전환은 그 콘텐츠가 처음 그려진 프레임부터 시작해요. 그래서 빈 화면이 아니라 실제 콘텐츠가 밀려 들어와요. 첫 렌더링이 무거우면 그만큼 시작이 늦어지지만, 애니메이션이 잘리거나 생략되지 않고 끝까지 재생돼요."
          },
          { type: "h3", text: "가려진 화면" },
          {
            type: "p",
            text: "새 화면에 가려진 이전 화면은 마운트된 채로 남아서 스크롤 위치나 폼 입력값 같은 DOM 상태가 유지돼요. flemo는 가려지는 즉시 그 화면을 그리지 않고, 경우에 따라 잠시 뒤에 React `Activity`로 숨겨요. 그래서 가려져 있는 동안에는 이펙트가 정리되고, pop으로 다시 보이면 이펙트가 다시 실행돼요."
          }
        ]
      }
    ]
  }
};

export default page;
