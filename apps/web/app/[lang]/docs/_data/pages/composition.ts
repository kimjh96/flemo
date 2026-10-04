import type { DocBlock, LocalizedDocPage } from "../docTypes";

// The whole inbox the page builds step by step: an app Router, a shared header
// whose title and button change as Parts, a panel with its own memory Router,
// a card Morph with a text Morph inside, and a menu drawn above the header
// through Layer. Mirrors .agents/skills/flemo/references/composition.md.
const compositionExample = `import { useState, type ReactNode } from "react";

import {
  Layer,
  Morph,
  Part,
  Route,
  Router,
  Screen,
  Slot,
  createPartTransition,
  useNavigate
} from "@flemo/react";

const ARRIVE = [0.4, 0, 1, 1] as const;
const LEAVE = [0, 0, 0.2, 1] as const;
// cupertino's easing, so the header moves in step with the screen on a swipe.
const TRANSITION_EASE = [0.32, 0.72, 0, 1] as const;

const headerTitle = createPartTransition({
  name: "header-title",
  initial: { opacity: 0, x: 72 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: TRANSITION_EASE } },
  enter: { value: { opacity: 0, x: -72 }, options: { ease: TRANSITION_EASE } },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: TRANSITION_EASE } },
  dismiss: { value: { opacity: 0, x: 72 }, options: { ease: TRANSITION_EASE } }
});

const headerAction = createPartTransition({
  name: "header-action",
  initial: { opacity: 0, x: 12 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: TRANSITION_EASE } },
  enter: { value: { opacity: 0, x: -12 }, options: { ease: TRANSITION_EASE } },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: TRANSITION_EASE } },
  dismiss: { value: { opacity: 0, x: 12 }, options: { ease: TRANSITION_EASE } }
});

const cardCopy = createPartTransition({
  name: "card-copy",
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { ease: ARRIVE } },
  enter: { value: { opacity: 0 }, options: { ease: LEAVE } },
  exit: { value: { opacity: 1 }, options: { ease: ARRIVE } },
  dismiss: { value: { opacity: 0 }, options: { ease: LEAVE } }
});

function Header({ title, action }: { title: string; action: ReactNode }) {
  return (
    <header className="app-header">
      <Part name="header-action">{action}</Part>
      <Part name="header-title">
        <h1>{title}</h1>
      </Part>
    </header>
  );
}

export function AppRouter() {
  return (
    <Router
      name="app"
      strictRoutes
      defaultTransitionName="cupertino"
      partTransitions={[headerTitle, headerAction, cardCopy]}
    >
      <Route path="/workspace" element={<Workspace />} />
      <Route path="/message/:id" element={<Message />} />
    </Router>
  );
}

function Workspace() {
  const app = useNavigate({ router: "app" });
  return (
    <Screen
      sharedTopBar={<Header title="Inbox" action={<button>Menu</button>} />}
      sharedTopBarId="app-header"
    >
      <Morph
        name="shared"
        layoutId="featured-message"
        onClick={() => app.push("/message/:id", { id: "42" })}
      >
        <article>
          <Part name="card-copy">
            <small>Today</small>
          </Part>
          <span style={{ display: "block", height: 24 }}>
            <Morph
              as="span"
              name="text"
              layoutId="featured-message-title"
              style={{ display: "block", fontSize: 16, lineHeight: "24px" }}
            >
              Featured message
            </Morph>
          </span>
          <Part name="card-copy">
            <p>Open message</p>
          </Part>
        </article>
      </Morph>

      <Router name="pane" history="memory" initPath="/list" className="pane">
        <nav>Local tools</nav>
        <Slot className="pane-slot">
          <Route path="/list" element={<MessageList />} />
          <Route path="/filters" element={<Filters />} />
        </Slot>
      </Router>
    </Screen>
  );
}

function MessageList() {
  const pane = useNavigate();
  const app = useNavigate({ router: "app" });
  const [overlayOpen, setOverlayOpen] = useState(false);
  return (
    <Screen>
      <button onClick={() => pane.push("/filters")}>Local filters</button>
      <button onClick={() => app.push("/message/:id", { id: "7" })}>Full-screen message</button>
      <button onClick={() => setOverlayOpen(true)}>Open command layer</button>
      {overlayOpen && (
        <Layer>
          <div className="app-overlay" role="dialog" aria-modal="true">
            <button onClick={() => setOverlayOpen(false)}>Close</button>
          </div>
        </Layer>
      )}
    </Screen>
  );
}

function Filters() {
  return <Screen>Filters</Screen>;
}

function Message() {
  const app = useNavigate({ router: "app" });
  return (
    <Screen
      sharedTopBar={
        <Header title="Message" action={<button onClick={() => app.pop()}>Back</button>} />
      }
      sharedTopBarId="app-header"
    >
      <Morph name="shared" layoutId="featured-message">
        <article>
          <Part name="card-copy">
            <small>Message 42</small>
          </Part>
          <span style={{ display: "block", height: 32 }}>
            <Morph
              as="span"
              name="text"
              layoutId="featured-message-title"
              style={{ display: "block", fontSize: 24, lineHeight: "32px" }}
            >
              Featured message
            </Morph>
          </span>
          <Part name="card-copy">
            <p>Full message</p>
          </Part>
        </article>
      </Morph>
    </Screen>
  );
}`;

const compositionExampleKo = compositionExample.replace(
  "// cupertino's easing, so the header moves in step with the screen on a swipe.",
  "// cupertino와 같은 easing이라 스와이프할 때 헤더가 화면과 함께 움직여요."
);

const stepApp = `<Router name="app" defaultTransitionName="cupertino">
  <Route path="/workspace" element={<Workspace />} />
  <Route path="/message/:id" element={<Message />} />
</Router>`;

const stepHeader = `function Header({ title, action }: { title: string; action: ReactNode }) {
  return (
    <header>
      <Part name="header-action">{action}</Part>
      <Part name="header-title">
        <h1>{title}</h1>
      </Part>
    </header>
  );
}

// Workspace
<Screen sharedTopBar={<Header title="Inbox" action={<MenuButton />} />} sharedTopBarId="app-header">

// Message
<Screen sharedTopBar={<Header title="Message" action={<BackButton />} />} sharedTopBarId="app-header">`;

const stepPane = `<Screen sharedTopBar={<Header title="Inbox" action={<MenuButton />} />} sharedTopBarId="app-header">
  <Router name="pane" history="memory" initPath="/list">
    <nav>Local tools</nav>
    <Slot>
      <Route path="/list" element={<MessageList />} />
      <Route path="/filters" element={<Filters />} />
    </Slot>
  </Router>
</Screen>`;

const stepTarget = (pane: string, app: string) => `function MessageList() {
  const pane = useNavigate(); // ${pane}
  const app = useNavigate({ router: "app" }); // ${app}

  return (
    <Screen>
      <button onClick={() => pane.push("/filters")}>Local filters</button>
      <button onClick={() => app.push("/message/:id", { id: "7" })}>Open message</button>
    </Screen>
  );
}`;

const stepMorph = (inbox: string, message: string) => `// ${inbox}
<Morph layoutId="featured-message" onClick={() => app.push("/message/:id", { id: "42" })}>
  <article>…</article>
</Morph>

// ${message}
<Morph layoutId="featured-message">
  <article>…</article>
</Morph>`;

const stepLayer = `{menuOpen && (
  <Layer>
    <div role="dialog" aria-modal="true">…</div>
  </Layer>
)}`;

const enBlocks: DocBlock[] = [
  {
    type: "demo",
    demo: "composition",
    caption:
      "Open **Local filters**: only the panel changes. Go back, then tap the **Morning brief** card: it grows into the message while the header title changes. Swipe from the left edge to go back."
  },
  {
    type: "p",
    text: "This page builds the inbox above one piece at a time. Each step adds one component and changes one thing you can see."
  },
  { type: "h", text: "1. One Router for the app" },
  {
    type: "p",
    text: "Start with two screens, the inbox and a message. One `Router` holds both, and pushing a message slides it in with `cupertino`."
  },
  { type: "code", lang: "tsx", code: stepApp },
  { type: "h", text: "2. A header that stays while its title changes" },
  {
    type: "p",
    text: "Both screens render the same header. Give them the same `sharedTopBarId` and the header stays in place during the transition instead of sliding with the screen."
  },
  {
    type: "p",
    text: "Wrap what differs between the two screens, the title and the left button, in `Part`. Only those parts animate, with the motion you register in the Router's `partTransitions`. They use the screen's duration and follow a swipe without extra code. See [Part](part)."
  },
  { type: "code", lang: "tsx", code: stepHeader },
  { type: "h", text: "3. A panel with its own back stack" },
  {
    type: "p",
    text: 'The lower panel of the inbox has its own pages, a list and filters. Put a second `Router` inside the inbox screen. `history="memory"` keeps its pages out of the URL.'
  },
  {
    type: "p",
    text: "Moving between those pages animates only the panel. The header and the browser history stay as they are."
  },
  { type: "code", lang: "tsx", code: stepPane },
  {
    type: "note",
    kind: "warn",
    text: "Without `Slot`, every child of a `Router` is treated as a route, so the `nav` above would be ignored. Wrap the routes in `Slot` whenever a Router has other children."
  },
  { type: "h", text: "4. Opening a full screen from the panel" },
  {
    type: "p",
    text: "`useNavigate()` targets the closest Router, which inside the panel is `pane`. To open the message over the whole app, name the outer Router."
  },
  {
    type: "code",
    lang: "tsx",
    code: stepTarget("the panel's Router", "the app Router")
  },
  {
    type: "p",
    text: "A name reaches the Routers that contain the component, never a sibling. The other ways to choose a Router are in [Navigation](navigation)."
  },
  { type: "h", text: "5. A card that grows into the next screen" },
  {
    type: "p",
    text: "Wrap the card on the inbox and the card on the message in `Morph` with the same `layoutId`. On push the card grows from its place in the inbox into the message; on pop it shrinks back."
  },
  { type: "code", lang: "tsx", code: stepMorph("Workspace, outside the panel", "Message") },
  {
    type: "p",
    text: "Keep the card in the inbox screen itself, not inside the panel. A Morph only pairs with Morphs on screens of the same Router, and inside the panel it would belong to `pane`, not `app`. See [Morph](morph)."
  },
  {
    type: "details",
    title: "When the title appears on both screens",
    blocks: [
      {
        type: "p",
        text: 'The card title is the same text at two sizes. Give it its own `Morph` with `name="text"` inside the card Morph, so the same letters resize instead of two copies fading over each other.'
      },
      {
        type: "p",
        text: "Set `display: block`, the font size and the line height on that text Morph, and put it in a wrapper that keeps the line's height. An inline element would show the words at the destination before they move."
      },
      {
        type: "p",
        text: 'Text that is different on each screen, like the "Today" label, is not shared. Put it in a `Part` outside the text Morph so it fades out and back in.'
      }
    ]
  },
  { type: "h", text: "6. A menu above the header" },
  {
    type: "p",
    text: "The menu opens from the panel but should cover the whole app, header included. A screen's content is drawn under the shared header, and `Layer` draws it above. To keep the menu inside the panel instead, render it without `Layer`. See [Layer](layer)."
  },
  { type: "code", lang: "tsx", code: stepLayer },
  { type: "h", text: "Check before shipping" },
  {
    type: "list",
    ordered: true,
    items: [
      "Go forward and back inside the panel. The header and the browser history do not change.",
      "Open the message from the panel. The whole app moves, not just the panel.",
      "Open the menu. It covers the header, and no screen changes.",
      "Swipe back slowly, let go early once, then swipe all the way. The title, the button, the screen and the card move together.",
      "Try a long title and no left button, so the header layout is tested rather than assumed.",
      "Judge the motion on a real device with developer tools closed. Then add `@flemo/devtools` and check that `window.flemo.report()` lists no anomalies."
    ]
  },
  { type: "h", text: "Full code" },
  { type: "code", lang: "tsx", title: "AppRouter.tsx", code: compositionExample }
];

const koBlocks: DocBlock[] = [
  {
    type: "demo",
    demo: "composition",
    caption:
      "**Local filters**를 열면 패널만 바뀌어요. 뒤로 간 다음 **Morning brief** 카드를 누르면 카드가 메시지 화면으로 커지면서 헤더 제목이 바뀌어요. 왼쪽 가장자리에서 스와이프하면 돌아와요."
  },
  {
    type: "p",
    text: "위의 받은편지함 화면을 한 단계씩 만들어 봐요. 단계마다 컴포넌트를 하나 추가하고, 그 결과 화면에서 무엇이 달라지는지 확인해요."
  },
  { type: "h", text: "1. 앱 전체를 담는 Router" },
  {
    type: "p",
    text: "받은편지함과 메시지, 두 화면으로 시작해요. `Router` 하나에 두 화면을 등록하면 메시지를 push할 때 `cupertino`로 밀려 들어와요."
  },
  { type: "code", lang: "tsx", code: stepApp },
  { type: "h", text: "2. 제목만 바뀌는 고정 헤더" },
  {
    type: "p",
    text: "두 화면 모두 같은 헤더를 그려요. 같은 `sharedTopBarId`를 주면 헤더가 화면과 함께 밀려나지 않고 제자리에 머물러요."
  },
  {
    type: "p",
    text: "화면마다 다른 부분인 제목과 왼쪽 버튼은 `Part`로 감싸요. 그러면 그 부분만 Router의 `partTransitions`에 등록한 애니메이션으로 바뀌어요. 지속 시간은 화면 전환과 같고, 별도 코드 없이 스와이프도 따라가요. 자세한 내용은 [Part](part)를 보세요."
  },
  { type: "code", lang: "tsx", code: stepHeader },
  { type: "h", text: "3. 자체 뒤로 가기가 있는 패널" },
  {
    type: "p",
    text: '받은편지함 아래쪽 패널에는 목록과 필터라는 자체 페이지가 있어요. 받은편지함 화면 안에 `Router`를 하나 더 두고, `history="memory"`를 주면 패널의 이동이 URL에 남지 않아요.'
  },
  {
    type: "p",
    text: "패널 안에서 이동하면 패널만 바뀌고, 헤더와 브라우저 히스토리는 그대로예요."
  },
  { type: "code", lang: "tsx", code: stepPane },
  {
    type: "note",
    kind: "warn",
    text: "`Slot`이 없으면 `Router`의 자식은 모두 라우트로 취급돼서 위의 `nav`는 무시돼요. 라우트 말고 다른 요소도 함께 두려면 라우트를 `Slot`으로 감싸세요."
  },
  { type: "h", text: "4. 패널에서 전체 화면 열기" },
  {
    type: "p",
    text: "`useNavigate()`는 가장 가까운 Router를 움직이는데, 패널 안에서는 `pane`이에요. 메시지를 앱 전체 화면으로 열려면 바깥 Router의 이름을 지정하세요."
  },
  {
    type: "code",
    lang: "tsx",
    code: stepTarget("패널의 Router", "앱 전체의 Router")
  },
  {
    type: "p",
    text: "이름으로는 컴포넌트를 감싸고 있는 바깥쪽 Router만 찾을 수 있고, 옆에 나란히 있는 Router는 찾지 못해요. Router를 고르는 다른 방법은 [Navigation](navigation)을 보세요."
  },
  { type: "h", text: "5. 다음 화면으로 커지는 카드" },
  {
    type: "p",
    text: "받은편지함의 카드와 메시지 화면의 카드를 같은 `layoutId`의 `Morph`로 감싸요. push하면 카드가 받은편지함 속 자리에서 메시지 화면으로 커지고, pop하면 다시 작아져요."
  },
  { type: "code", lang: "tsx", code: stepMorph("받은편지함 화면, 패널 바깥", "메시지 화면") },
  {
    type: "p",
    text: "카드는 패널 안이 아니라 받은편지함 화면에 바로 두세요. Morph는 같은 Router에 속한 화면끼리만 짝을 이루는데, 패널 안에 두면 `app`이 아니라 `pane`에 속하게 돼요. 자세한 내용은 [Morph](morph)를 보세요."
  },
  {
    type: "details",
    title: "제목이 두 화면에 모두 있을 때",
    blocks: [
      {
        type: "p",
        text: '카드 제목은 두 화면에서 크기만 다른 같은 글자예요. 카드 Morph 안에서 제목을 `name="text"`인 `Morph`로 한 번 더 감싸면, 두 벌의 글자가 겹쳐 흐려지는 대신 같은 글자가 크기만 바뀌어요.'
      },
      {
        type: "p",
        text: "이 텍스트 Morph에는 `display: block`, 글자 크기, 줄 높이를 직접 지정하고, 줄 높이를 유지하는 래퍼로 감싸세요. 인라인 요소로 두면 글자가 움직이기 전에 도착 위치에 먼저 보여요."
      },
      {
        type: "p",
        text: '"Today" 라벨처럼 화면마다 내용이 다른 텍스트는 공유하지 않아요. 텍스트 Morph 바깥에서 `Part`로 감싸면 사라졌다가 다시 나타나요.'
      }
    ]
  },
  { type: "h", text: "6. 헤더까지 덮는 메뉴" },
  {
    type: "p",
    text: "메뉴는 패널에서 열지만 헤더를 포함한 앱 전체를 덮어야 해요. 화면 안의 콘텐츠는 고정 헤더 아래에 그려지는데, `Layer`로 감싸면 헤더 위에 그려져요. 메뉴를 패널 안에만 두려면 `Layer` 없이 그리면 돼요. 자세한 내용은 [Layer](layer)를 보세요."
  },
  { type: "code", lang: "tsx", code: stepLayer },
  { type: "h", text: "배포 전 확인" },
  {
    type: "list",
    ordered: true,
    items: [
      "패널 안에서 이동했다가 돌아와 보세요. 헤더와 브라우저 히스토리는 바뀌지 않아야 해요.",
      "패널에서 메시지를 열어 보세요. 패널만이 아니라 앱 전체가 움직여야 해요.",
      "메뉴를 열어 보세요. 헤더까지 덮고, 화면은 바뀌지 않아야 해요.",
      "천천히 스와이프하다가 한 번은 중간에 놓고, 한 번은 끝까지 밀어 보세요. 제목, 버튼, 화면, 카드가 함께 움직여야 해요.",
      "긴 제목, 왼쪽 버튼이 없는 헤더로도 확인해서 헤더 레이아웃을 직접 검증하세요.",
      "움직임은 개발자 도구를 닫고 실제 기기에서 판단하세요. 그다음 `@flemo/devtools`를 붙여 `window.flemo.report()`에 이상 항목이 없는지 확인하세요."
    ]
  },
  { type: "h", text: "전체 코드" },
  { type: "code", lang: "tsx", title: "AppRouter.tsx", code: compositionExampleKo }
];

const page: LocalizedDocPage = {
  en: {
    slug: "composition",
    title: "Putting it together",
    summary:
      "Build an inbox step by step: a header whose title changes, a panel with its own back stack, a card that grows into the next screen, and a menu drawn above everything.",
    blocks: enBlocks
  },
  ko: {
    slug: "composition",
    title: "Putting it together",
    summary:
      "받은편지함 화면을 단계별로 만들어 봐요. 제목만 바뀌는 헤더, 자체 뒤로 가기가 있는 패널, 다음 화면으로 커지는 카드, 모든 화면 위에 뜨는 메뉴를 차례로 더해요.",
    blocks: koBlocks
  }
};

export default page;
