import type { DocBlock, LocalizedDocPage } from "../docTypes";

// The whole Places app the page builds step by step, the same one its demo
// runs: an app Router, a shared header whose title and action change as Parts,
// a featured card that grows into its place as a Morph, a panel with its own
// memory Router, and a menu the panel opens in a Layer above the header.
const compositionExample = `import { useState, type ReactNode } from "react";

import {
  Layer,
  Morph,
  Part,
  Route,
  Router,
  Screen,
  createPartTransition,
  useNavigate,
  useParams
} from "@flemo/react";

import { Avatar, BackButton, PLACES, Photo } from "./ui";

// cupertino's easing, so the header moves in step with the screen on a swipe.
const EASE = [0.32, 0.72, 0, 1] as const;

const barTitle = createPartTransition({
  name: "bar-title",
  initial: { opacity: 0, x: 56 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: EASE } },
  enter: { value: { opacity: 0, x: -56 }, options: { ease: EASE } },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: EASE } },
  dismiss: { value: { opacity: 0, x: 56 }, options: { ease: EASE } }
});

const barAction = createPartTransition({
  name: "bar-action",
  initial: { opacity: 0, x: 10 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: EASE } },
  enter: { value: { opacity: 0, x: -10 }, options: { ease: EASE } },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: EASE } },
  dismiss: { value: { opacity: 0, x: 10 }, options: { ease: EASE } }
});

function TopBar({ title, action }: { title: string; action: ReactNode }) {
  return (
    <header className="top-bar">
      <Part name="bar-action">{action}</Part>
      <Part name="bar-title">
        <h1>{title}</h1>
      </Part>
    </header>
  );
}

export function App() {
  return (
    <Router name="trip" defaultTransitionName="cupertino" partTransitions={[barTitle, barAction]}>
      <Route path="/trip" element={<Home />} />
      <Route path="/trip/:id" element={<Place />} />
    </Router>
  );
}

function Home() {
  const { push } = useNavigate();

  return (
    <Screen sharedTopBar={<TopBar title="Places" action={<Avatar />} />} sharedTopBarId="trip-bar">
      <button onClick={() => push("/trip/:id", { id: "kyoto" })}>
        <Morph layoutId="trip-art-kyoto" className="card-photo">
          <Photo place="kyoto" />
        </Morph>
        Kyoto
      </button>

      <Router name="panel" history="memory" initPath="/panel" className="panel">
        <Route path="/panel" element={<Saved />} />
        <Route path="/panel/filters" element={<Filters />} />
      </Router>
    </Screen>
  );
}

function Saved() {
  const panel = useNavigate();
  const app = useNavigate({ router: "trip" });
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Screen>
      <button onClick={() => panel.push("/panel/filters")}>Filter</button>
      <button onClick={() => setMenuOpen(true)}>More</button>
      {["lisbon", "oaxaca", "reykjavik"].map((id) => (
        <button key={id} onClick={() => app.push("/trip/:id", { id })}>
          {PLACES[id].name}
        </button>
      ))}
      {menuOpen && (
        <Layer>
          <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
            <div role="dialog" aria-modal="true" className="sheet">
              Saved places
            </div>
          </div>
        </Layer>
      )}
    </Screen>
  );
}

function Filters() {
  const { pop } = useNavigate();

  return (
    <Screen>
      <button onClick={() => pop()}>Back</button>
      Filters
    </Screen>
  );
}

function Place() {
  const { id } = useParams<"/trip/:id">();
  const { pop } = useNavigate();

  return (
    <Screen
      sharedTopBar={
        <TopBar title={PLACES[id].name} action={<BackButton onClick={() => pop()} />} />
      }
      sharedTopBarId="trip-bar"
    >
      <Morph layoutId={\`trip-art-\${id}\`} className="hero-photo">
        <Photo place={id} />
      </Morph>
      <p>{PLACES[id].description}</p>
    </Screen>
  );
}`;

const compositionExampleKo = compositionExample.replace(
  "// cupertino's easing, so the header moves in step with the screen on a swipe.",
  "// cupertino와 같은 easing이라 스와이프할 때 헤더가 화면과 함께 움직여요."
);

const stepApp = `<Router name="trip" defaultTransitionName="cupertino">
  <Route path="/trip" element={<Home />} />
  <Route path="/trip/:id" element={<Place />} />
</Router>`;

const stepHeader = `function TopBar({ title, action }: { title: string; action: ReactNode }) {
  return (
    <header>
      <Part name="bar-action">{action}</Part>
      <Part name="bar-title">
        <h1>{title}</h1>
      </Part>
    </header>
  );
}

// Home
<Screen sharedTopBar={<TopBar title="Places" action={<Avatar />} />} sharedTopBarId="trip-bar">

// Place
<Screen sharedTopBar={<TopBar title="Kyoto" action={<BackButton />} />} sharedTopBarId="trip-bar">`;

const stepPanel = `<Screen sharedTopBar={<TopBar title="Places" action={<Avatar />} />} sharedTopBarId="trip-bar">
  <FeaturedCard />
  <Router name="panel" history="memory" initPath="/panel" className="panel">
    <Route path="/panel" element={<Saved />} />
    <Route path="/panel/filters" element={<Filters />} />
  </Router>
</Screen>`;

const stepTarget = (panel: string, app: string) => `function Saved() {
  const panel = useNavigate(); // ${panel}
  const app = useNavigate({ router: "trip" }); // ${app}

  return (
    <Screen>
      <button onClick={() => panel.push("/panel/filters")}>Filter</button>
      <button onClick={() => app.push("/trip/:id", { id: "lisbon" })}>Lisbon</button>
    </Screen>
  );
}`;

const stepMorph = (home: string, place: string) => `// ${home}
<button onClick={() => push("/trip/:id", { id: "kyoto" })}>
  <Morph layoutId="trip-art-kyoto">
    <Photo place="kyoto" />
  </Morph>
</button>

// ${place}
<Morph layoutId={\`trip-art-\${id}\`}>
  <Photo place={id} />
</Morph>`;

const stepLayer = `{menuOpen && (
  <Layer>
    <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
      <div role="dialog" aria-modal="true">…</div>
    </div>
  </Layer>
)}`;

const enBlocks: DocBlock[] = [
  {
    type: "demo",
    demo: "composition",
    caption:
      "Tap **Filter**: only the panel changes. Go back, then tap the Kyoto card: it grows into the place while the header title changes. **⋯** opens a menu drawn over the header. Swipe from the left edge to go back."
  },
  {
    type: "p",
    text: "This page builds the Places app above one piece at a time. Each step adds one component and changes one thing you can see."
  },
  { type: "h", text: "1. One Router for the app" },
  {
    type: "p",
    text: "Start with two screens, the list of places and a place. One `Router` holds both, and pushing a place slides it in with `cupertino`."
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
    text: 'The Saved panel on the home screen has its own pages, the list and its filters. Put a second `Router` inside the home screen. `history="memory"` keeps its pages out of the URL.'
  },
  {
    type: "p",
    text: "Moving between those pages animates only the panel. The header and the browser history stay as they are."
  },
  { type: "code", lang: "tsx", code: stepPanel },
  {
    type: "note",
    kind: "warn",
    text: "Without `Slot`, every child of a `Router` is treated as a route. If the panel also needs a heading or tabs beside its routes, wrap the routes in `Slot`."
  },
  { type: "h", text: "4. Opening a full screen from the panel" },
  {
    type: "p",
    text: "`useNavigate()` targets the closest Router, which inside the panel is `panel`. To open a place over the whole app, name the outer Router."
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
    text: "Wrap the photo on the featured card and the photo on the place in `Morph` with the same `layoutId`. On push the card grows from its spot on the home screen into the place; on pop it shrinks back."
  },
  { type: "code", lang: "tsx", code: stepMorph("Home, outside the panel", "Place") },
  {
    type: "p",
    text: "Keep the card in the home screen itself, not inside the panel. A Morph only pairs with Morphs on screens of the same Router, and inside the panel it would belong to `panel`, not `trip`. That is why a place opened from the panel arrives with its screen instead of growing. Let the photo fill the Morph's box, because the box is laid out at each size rather than scaled. See [Morph](morph)."
  },
  {
    type: "details",
    title: "When the title appears on both screens",
    blocks: [
      {
        type: "p",
        text: 'If the card also shows the place name, and the place shows it bigger, that is the same text at two sizes. Give it its own `Morph` with `name="text"` inside the card Morph, so the same letters resize instead of two copies fading over each other.'
      },
      {
        type: "p",
        text: "Set `display: block`, the font size and the line height on that text Morph, and put it in a wrapper that keeps the line's height. An inline element would show the words at the destination before they move."
      },
      {
        type: "p",
        text: "Text that is different on each screen, like a label that reads only on the card, is not shared. Put it in a `Part` outside the text Morph so it fades out and back in."
      }
    ]
  },
  { type: "h", text: "6. A menu above the header" },
  {
    type: "p",
    text: "The menu opens from the panel but should cover the whole app, header included. A screen's content is drawn under the shared header, and `Layer` draws it above. To keep the menu inside the panel instead, render it without `Layer`. See [Layer](layer)."
  },
  { type: "code", lang: "tsx", code: stepLayer },
  {
    type: "note",
    kind: "tip",
    text: "The demo above runs inside this page, so its app Router sets `ownsLayers` to keep the menu inside the phone instead of over the site. An app whose `Router` is the outermost one does not need it."
  },
  { type: "h", text: "Check before shipping" },
  {
    type: "list",
    ordered: true,
    items: [
      "Go forward and back inside the panel. The header and the browser history do not change.",
      "Open a place from the panel. The whole app moves, not just the panel.",
      "Open the menu. It covers the header, and no screen changes.",
      "Swipe back slowly, let go early once, then swipe all the way. The title, the button, the screen and the card move together.",
      "Try a long title and no left button, so the header layout is tested rather than assumed.",
      "Judge the motion on a real device with developer tools closed. Then add `@flemo/devtools` and check that `window.flemo.report()` lists no anomalies."
    ]
  },
  { type: "h", text: "Full code" },
  { type: "code", lang: "tsx", title: "App.tsx", code: compositionExample }
];

const koBlocks: DocBlock[] = [
  {
    type: "demo",
    demo: "composition",
    caption:
      "**필터**를 누르면 패널만 바뀌어요. 뒤로 간 다음 교토 카드를 누르면 카드가 상세 화면으로 커지면서 헤더 제목이 바뀌어요. **⋯**을 누르면 헤더까지 덮는 메뉴가 열려요. 왼쪽 가장자리에서 스와이프하면 돌아와요."
  },
  {
    type: "p",
    text: "위의 장소 앱을 한 단계씩 만들어 봐요. 단계마다 컴포넌트를 하나 추가하고, 그 결과 화면에서 무엇이 달라지는지 확인해요."
  },
  { type: "h", text: "1. 앱 전체를 담는 Router" },
  {
    type: "p",
    text: "장소 목록과 장소 상세, 두 화면으로 시작해요. `Router` 하나에 두 화면을 등록하면 장소를 push할 때 `cupertino`로 밀려 들어와요."
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
    text: '홈 화면의 저장함 패널에는 목록과 필터라는 자체 페이지가 있어요. 홈 화면 안에 `Router`를 하나 더 두고, `history="memory"`를 주면 패널의 이동이 URL에 남지 않아요.'
  },
  {
    type: "p",
    text: "패널 안에서 이동하면 패널만 바뀌고, 헤더와 브라우저 히스토리는 그대로예요."
  },
  { type: "code", lang: "tsx", code: stepPanel },
  {
    type: "note",
    kind: "warn",
    text: "`Slot`이 없으면 `Router`의 자식은 모두 라우트로 취급돼요. 패널에 라우트 말고 제목이나 탭도 함께 두려면 라우트를 `Slot`으로 감싸세요."
  },
  { type: "h", text: "4. 패널에서 전체 화면 열기" },
  {
    type: "p",
    text: "`useNavigate()`는 가장 가까운 Router를 움직이는데, 패널 안에서는 `panel`이에요. 장소를 앱 전체 화면으로 열려면 바깥 Router의 이름을 지정하세요."
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
    text: "추천 카드의 사진과 장소 화면의 사진을 같은 `layoutId`의 `Morph`로 감싸요. push하면 카드가 홈 화면 속 자리에서 장소 화면으로 커지고, pop하면 다시 작아져요."
  },
  { type: "code", lang: "tsx", code: stepMorph("홈 화면, 패널 바깥", "장소 화면") },
  {
    type: "p",
    text: "카드는 패널 안이 아니라 홈 화면에 바로 두세요. Morph는 같은 Router에 속한 화면끼리만 짝을 이루는데, 패널 안에 두면 `trip`이 아니라 `panel`에 속하게 돼요. 그래서 패널에서 연 장소는 커지지 않고 화면과 함께 들어와요. 상자는 확대·축소되지 않고 크기마다 다시 배치되니, 사진이 Morph 상자를 꽉 채우게 하세요. 자세한 내용은 [Morph](morph)를 보세요."
  },
  {
    type: "details",
    title: "제목이 두 화면에 모두 있을 때",
    blocks: [
      {
        type: "p",
        text: '카드에도 장소 이름이 있고 장소 화면에는 더 크게 있다면, 크기만 다른 같은 글자예요. 카드 Morph 안에서 이름을 `name="text"`인 `Morph`로 한 번 더 감싸면, 두 벌의 글자가 겹쳐 흐려지는 대신 같은 글자가 크기만 바뀌어요.'
      },
      {
        type: "p",
        text: "이 텍스트 Morph에는 `display: block`, 글자 크기, 줄 높이를 직접 지정하고, 줄 높이를 유지하는 래퍼로 감싸세요. 인라인 요소로 두면 글자가 움직이기 전에 도착 위치에 먼저 보여요."
      },
      {
        type: "p",
        text: "카드에만 있는 라벨처럼 화면마다 내용이 다른 텍스트는 공유하지 않아요. 텍스트 Morph 바깥에서 `Part`로 감싸면 사라졌다가 다시 나타나요."
      }
    ]
  },
  { type: "h", text: "6. 헤더까지 덮는 메뉴" },
  {
    type: "p",
    text: "메뉴는 패널에서 열지만 헤더를 포함한 앱 전체를 덮어야 해요. 화면 안의 콘텐츠는 고정 헤더 아래에 그려지는데, `Layer`로 감싸면 헤더 위에 그려져요. 메뉴를 패널 안에만 두려면 `Layer` 없이 그리면 돼요. 자세한 내용은 [Layer](layer)를 보세요."
  },
  { type: "code", lang: "tsx", code: stepLayer },
  {
    type: "note",
    kind: "tip",
    text: "위 데모는 이 문서 페이지 안에서 돌아가기 때문에, 앱 Router에 `ownsLayers`를 줘서 메뉴가 사이트 전체가 아니라 휴대폰 안에 그려지게 했어요. `Router`가 가장 바깥에 있는 앱이라면 필요 없어요."
  },
  { type: "h", text: "배포 전 확인" },
  {
    type: "list",
    ordered: true,
    items: [
      "패널 안에서 이동했다가 돌아와 보세요. 헤더와 브라우저 히스토리는 바뀌지 않아야 해요.",
      "패널에서 장소를 열어 보세요. 패널만이 아니라 앱 전체가 움직여야 해요.",
      "메뉴를 열어 보세요. 헤더까지 덮고, 화면은 바뀌지 않아야 해요.",
      "천천히 스와이프하다가 한 번은 중간에 놓고, 한 번은 끝까지 밀어 보세요. 제목, 버튼, 화면, 카드가 함께 움직여야 해요.",
      "긴 제목, 왼쪽 버튼이 없는 헤더로도 확인해서 헤더 레이아웃을 직접 검증하세요.",
      "움직임은 개발자 도구를 닫고 실제 기기에서 판단하세요. 그다음 `@flemo/devtools`를 붙여 `window.flemo.report()`에 이상 항목이 없는지 확인하세요."
    ]
  },
  { type: "h", text: "전체 코드" },
  { type: "code", lang: "tsx", title: "App.tsx", code: compositionExampleKo }
];

const page: LocalizedDocPage = {
  en: {
    slug: "composition",
    title: "Putting it together",
    summary:
      "Build a Places app step by step: a header whose title changes, a panel with its own back stack, a card that grows into the next screen, and a menu drawn above everything.",
    blocks: enBlocks
  },
  ko: {
    slug: "composition",
    title: "Putting it together",
    summary:
      "장소 앱을 단계별로 만들어 봐요. 제목만 바뀌는 헤더, 자체 뒤로 가기가 있는 패널, 다음 화면으로 커지는 카드, 모든 화면 위에 뜨는 메뉴를 차례로 더해요.",
    blocks: koBlocks
  }
};

export default page;
