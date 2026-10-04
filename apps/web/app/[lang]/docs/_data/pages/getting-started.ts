import type { LocalizedDocPage } from "../docTypes";

const appCode = `import { Route, Router } from "@flemo/react";

import Home from "./Home";
import Post from "./Post";

export default function App() {
  return (
    <Router>
      <Route path="/" element={<Home />} />
      <Route path="/posts/:slug" element={<Post />} />
    </Router>
  );
}`;

const homeCode = (
  label: string,
  comment: string
) => `import { Screen, useNavigate } from "@flemo/react";

export default function Home() {
  const navigate = useNavigate();

  return (
    <Screen>
      <h1>Home</h1>
      <button onClick={() => navigate.push("/posts/:slug", { slug: "hello" })}>
        ${label}
      </button>
    </Screen>
  );
}

// ${comment}
declare module "@flemo/react" {
  interface RegisterRoute {
    "/": undefined;
  }
}`;

const postCode = (
  label: string,
  comment: string
) => `import { Screen, useNavigate, useParams } from "@flemo/react";

export default function Post() {
  const navigate = useNavigate();
  const { slug } = useParams<"/posts/:slug">();

  return (
    <Screen>
      <h1>{slug}</h1>
      <button onClick={() => navigate.pop()}>${label}</button>
    </Screen>
  );
}

// ${comment}
declare module "@flemo/react" {
  interface RegisterRoute {
    "/posts/:slug": { slug: string };
  }
}`;

const transitionCode = (comment1: string, comment2: string) => `// ${comment1}
<Router defaultTransitionName="material">
  <Route path="/" element={<Home />} />
  <Route path="/posts/:slug" element={<Post />} />
</Router>;

// ${comment2}
navigate.push("/posts/:slug", { slug: "hello" }, { transitionName: "layout" });`;

const page: LocalizedDocPage = {
  en: {
    slug: "getting-started",
    title: "Getting started",
    summary:
      "Build the smallest complete flemo app: two screens, one typed route param, and a push you can pop with Back, a button, or a swipe.",
    blocks: [
      { type: "h", text: "Install" },
      { type: "code", lang: "bash", code: "pnpm add @flemo/react" },
      {
        type: "p",
        text: "`@flemo/react` needs `react` and `react-dom` 19.2.8 or later as peer dependencies."
      },
      { type: "note", kind: "note", text: "Svelte and SolidJS support is planned." },
      { type: "h", text: "Mount the Router" },
      {
        type: "p",
        text: "`Router` manages the screen stack. Each `Route` sets the screen that renders for one path."
      },
      { type: "code", lang: "tsx", title: "App.tsx", code: appCode, highlight: [8, 9, 10] },
      { type: "h", text: "Build a screen and register its route" },
      {
        type: "p",
        text: "Every route component renders a `Screen`. To open another screen, call `navigate.push` with the route pattern and its params."
      },
      {
        type: "p",
        text: "Augment `RegisterRoute` so TypeScript checks every path and params object. Until you do, `push` accepts no path at all."
      },
      {
        type: "code",
        lang: "tsx",
        title: "Home.tsx",
        code: homeCode("Open hello", "A route without params maps to undefined."),
        highlight: [9, 19]
      },
      { type: "h", text: "Read params and pop" },
      {
        type: "p",
        text: "`useParams` returns the screen's params, typed by its registered route. `navigate.pop()` goes back one screen."
      },
      {
        type: "code",
        lang: "tsx",
        title: "Post.tsx",
        code: postCode("Back", "A dynamic route maps to its param shape."),
        highlight: [5, 10]
      },
      {
        type: "p",
        text: "Tap Open hello to push the post. Go back with browser Back, the Back button, or a drag from the left edge."
      },
      { type: "h", text: "Pick a transition" },
      {
        type: "p",
        text: "Every navigation plays `cupertino` by default. Change the default on the `Router`, or pass `transitionName` to one call."
      },
      {
        type: "code",
        lang: "tsx",
        code: transitionCode(
          "Every navigation in this Router uses material.",
          "This one push uses layout."
        ),
        highlight: [2, 8]
      },
      {
        type: "p",
        text: "The built-in presets are `cupertino`, `material`, `layout`, and `none`. See [Transitions](transitions) for gestures and custom motion."
      },
      {
        type: "details",
        title: "What just happened",
        blocks: [
          {
            type: "list",
            items: [
              "`push` compiles the pattern and params into a URL, adds a real browser history entry, and plays the transition.",
              "Params the path does not use become the query string, and `useParams` reads path and query params as one object.",
              "A root `Router` with no `Slot` fills the viewport, and its children are its routes.",
              "Every `declare module` block merges into one global `RegisterRoute`, so you can declare each route next to the screen that renders it."
            ]
          }
        ]
      }
    ]
  },
  ko: {
    slug: "getting-started",
    title: "Getting started",
    summary:
      "화면 두 개짜리 가장 작은 flemo 앱을 만들어요. 라우트 파라미터에 타입을 붙이고, push로 연 화면에서 브라우저 뒤로 가기, 버튼, 스와이프로 돌아와 봐요.",
    blocks: [
      { type: "h", text: "설치" },
      { type: "code", lang: "bash", code: "pnpm add @flemo/react" },
      {
        type: "p",
        text: "`@flemo/react`를 쓰려면 peer dependency로 `react`와 `react-dom` 19.2.8 이상이 필요해요."
      },
      { type: "note", kind: "note", text: "Svelte와 SolidJS 지원도 준비하고 있어요." },
      { type: "h", text: "Router 마운트" },
      {
        type: "p",
        text: "`Router`가 화면 스택을 관리하고, 각 `Route`에는 경로와 그 경로에서 보여 줄 화면을 적어요."
      },
      { type: "code", lang: "tsx", title: "App.tsx", code: appCode, highlight: [8, 9, 10] },
      { type: "h", text: "화면 만들고 라우트 등록하기" },
      {
        type: "p",
        text: "라우트 컴포넌트는 모두 `Screen`을 렌더링해요. 다른 화면을 열 때는 `navigate.push`에 라우트 패턴과 파라미터를 넘기면 돼요."
      },
      {
        type: "p",
        text: "`RegisterRoute`를 확장하면 TypeScript가 경로와 파라미터 객체를 모두 검사해 줘요. 확장하기 전에는 `push`에 어떤 경로도 넘길 수 없어요."
      },
      {
        type: "code",
        lang: "tsx",
        title: "Home.tsx",
        code: homeCode("Open hello", "파라미터가 없는 라우트는 undefined로 적어요."),
        highlight: [9, 19]
      },
      { type: "h", text: "파라미터 읽고 돌아가기" },
      {
        type: "p",
        text: "`useParams`로 현재 화면의 파라미터를 읽으면 등록한 라우트에 맞는 타입으로 받아요. `navigate.pop()`을 호출하면 이전 화면으로 돌아가요."
      },
      {
        type: "code",
        lang: "tsx",
        title: "Post.tsx",
        code: postCode("Back", "동적 라우트는 파라미터 객체의 타입을 적어요."),
        highlight: [5, 10]
      },
      {
        type: "p",
        text: "Open hello를 누르면 글 화면이 열려요. 돌아올 때는 브라우저 뒤로 가기, Back 버튼, 왼쪽 가장자리에서 스와이프하기 중 아무거나 쓰면 돼요."
      },
      { type: "h", text: "화면 전환 고르기" },
      {
        type: "p",
        text: "따로 지정하지 않으면 모든 이동에 `cupertino` 트랜지션이 쓰여요. `Router`에서 기본값을 바꾸거나, 이동 한 번에만 다른 트랜지션을 쓰려면 `transitionName`을 넘기세요."
      },
      {
        type: "code",
        lang: "tsx",
        code: transitionCode(
          "이 Router 안의 모든 이동은 material을 써요.",
          "이 push만 layout을 써요."
        ),
        highlight: [2, 8]
      },
      {
        type: "p",
        text: "기본으로 들어 있는 프리셋은 `cupertino`, `material`, `layout`, `none`이에요. 제스처와 직접 만드는 애니메이션은 [Transitions](transitions)에서 다뤄요."
      },
      {
        type: "details",
        title: "내부에서 일어난 일",
        blocks: [
          {
            type: "list",
            items: [
              "`push`는 패턴과 파라미터로 URL을 만들어 브라우저 히스토리에 실제로 항목을 추가하고, 화면 전환을 재생해요.",
              "경로에 쓰이지 않은 파라미터는 쿼리 문자열로 붙어요. `useParams`는 경로 파라미터와 쿼리 파라미터를 한 객체로 합쳐서 돌려줘요.",
              "`Slot` 없이 최상위에 둔 `Router`는 뷰포트 전체를 채우고, 자식은 모두 라우트로 취급돼요.",
              "`declare module` 블록은 모두 하나의 전역 `RegisterRoute`로 합쳐져요. 그래서 라우트 타입을 각 화면 파일 옆에 따로 선언해도 돼요."
            ]
          }
        ]
      }
    ]
  }
};

export default page;
