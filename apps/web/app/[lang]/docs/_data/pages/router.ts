import type { LocalizedDocPage } from "../docTypes";

const basicCode = `<Router>
  <Route path="/" element={<Home />} />
  <Route path="/posts/:slug" element={<Post />} />
  <Route path={["/settings", "/settings/:tab"]} element={<Settings />} />
</Router>`;

const patternsCode = (c: [string, string, string, string]) => `"/"; // ${c[0]}
"/posts/:slug"; // ${c[1]}
"/users/:id/posts/:p"; // ${c[2]}
"/files/*splat"; // ${c[3]}`;

const registerCode = `declare module "@flemo/react" {
  interface RegisterRoute {
    "/": undefined;
    "/posts/:slug": { slug: string };
  }
}`;

const typeCheckCode = (ok: string, err: string) =>
  `navigate.push("/posts/:slug", { slug: "hello" }); // ${ok}
navigate.push("/posts/:slug", { id: "1" }); // ${err}
navigate.push("/unknown"); // ${err}`;

const nestedCode = `<Router name="app">
  <Route path="/members/:id" element={<Member />} />
  <Route path={["/region", "/region/people"]} element={<RegionActivity />} />
</Router>;

function RegionActivity() {
  return (
    <Router name="region" initPath="/region" className="h-full w-full">
      <RegionHeader />
      <Slot className="h-full w-full">
        <Route path="/region" element={<RegionFeed />} />
        <Route path="/region/people" element={<RegionPeople />} />
      </Slot>
    </Router>
  );
}`;

const registerRouterCode = `declare module "@flemo/react" {
  interface RegisterRouter {
    app: true;
    region: true;
  }
}`;

const ssrCode = (comment: string) => `// ${comment}
<Router initPath={requestPathname}>
  <Route path="/" element={<Home />} />
  <Route path="/posts/:slug" element={<Post />} />
</Router>`;

const driverCode = (
  comment: string
) => `import { createBrowserHistoryDriver, type HistoryDriver } from "@flemo/react";

// ${comment}
function createPrefixDriver(routerKey?: string): HistoryDriver {
  const base = createBrowserHistoryDriver(routerKey);
  const strip = (pathname: string) => pathname.replace(/^\\/ko(?=\\/|$)/, "") || "/";
  const add = (url: string) => (url === "/" ? "/ko" : \`/ko\${url}\`);

  return {
    ...base,
    readPathname: () => strip(base.readPathname()),
    pushState: (state, url) => base.pushState(state, add(url)),
    replaceState: (state, url) => base.replaceState(state, add(url)),
    subscribe: (listener) =>
      base.subscribe((event) => listener({ ...event, pathname: strip(event.pathname) }))
  };
}

<Router createDriver={createPrefixDriver}>{/* routes */}</Router>;`;

const page: LocalizedDocPage = {
  en: {
    slug: "router",
    title: "Router and Route",
    summary:
      "`Router` manages one screen stack, its history, and its transitions; each `Route` maps a path pattern to the screen it renders.",
    blocks: [
      { type: "code", lang: "tsx", code: basicCode },
      {
        type: "p",
        text: "Each `Route` maps a `path`, or an array of paths, to an `element`, normally a `Screen`. Without a [Slot](slot), the Router's children are its routes and its screens fill the viewport."
      },
      { type: "h", text: "Path patterns" },
      {
        type: "p",
        text: "flemo matches paths with path-to-regexp v8."
      },
      {
        type: "code",
        lang: "ts",
        code: patternsCode(["exact", "one param", "several params", "wildcard"])
      },
      { type: "h", text: "Type-safe routes" },
      {
        type: "p",
        text: "Augment `RegisterRoute` and `navigate.push`, `useParams`, and the other hooks check against it. Map a route without params to `undefined`."
      },
      { type: "code", lang: "ts", code: registerCode },
      { type: "code", lang: "tsx", code: typeCheckCode("ok", "type error") },
      {
        type: "note",
        kind: "tip",
        text: "`declare module` blocks merge, so declare each route at the bottom of its screen's file, not in a central registry. Do the same for `RegisterTransition`, `RegisterDecorator`, and `RegisterPartTransition`."
      },
      { type: "h", text: "Router props" },
      {
        type: "table",
        headers: ["Prop", "Default", "What it does"],
        rows: [
          [
            "`defaultTransitionName`",
            "`cupertino`",
            "Transition used when a navigation does not set one"
          ],
          ["`transitions`", "`[]`", "Custom screen transitions to register"],
          ["`decorators`", "`[]`", "Custom decorators (overlays) to register"],
          ["`partTransitions`", "`[]`", "Custom [Part](part) transitions to register"],
          ["`morphTransitions`", "`[]`", "Custom [Morph](morph) transitions to register"],
          [
            "`history`",
            "`browser`",
            "`browser` (URL, back/forward) or `memory` (isolated, no URL)"
          ],
          ["`createDriver`", "none", "Replaces the browser history driver"],
          ["`initPath`", "`/`", "Start path when the URL is not read: server, nested, or memory"],
          ["`name`", "none", "Name that navigation from another Router uses to target this one"],
          ["`strictRoutes`", "`false`", "Makes the missing-route warning an error"],
          ["`className` / `style`", "none", "Size a nested Router's box"]
        ]
      },
      { type: "h", text: "Nested and named Routers" },
      {
        type: "p",
        text: 'A `Router` inside another is a separate area with its own stack, contained to a box you size. It still uses browser history unless you pass `history="memory"`, for a demo, wizard, or carousel.'
      },
      {
        type: "p",
        text: "Give a Router a `name` when code in a nested Router must move it, like a card opening a full-screen detail. [Navigation](navigation) shows how to target it."
      },
      { type: "code", lang: "tsx", code: nestedCode, highlight: [1, 8] },
      {
        type: "p",
        text: "Registering names is optional. Once registered, a `router` target that matches no registered Router name is a compile error."
      },
      { type: "code", lang: "ts", code: registerRouterCode },
      { type: "h", text: "Server-side rendering" },
      {
        type: "p",
        text: "flemo drives `window.history` once it mounts. The server has no URL, so pass the first route to render as `initPath`. A pure SPA (Vite and similar) does not need it."
      },
      {
        type: "code",
        lang: "tsx",
        code: ssrCode(
          "On the server, the root Router renders initPath. On the client it reads the URL."
        )
      },
      {
        type: "note",
        kind: "warn",
        text: "flemo does not work alongside a host framework that also handles routing. Use it as a pure SPA, or as a self-contained client-only area that does not share routing with the host."
      },
      {
        type: "details",
        title: "Edge cases",
        blocks: [
          { type: "h3", text: "Routes" },
          {
            type: "list",
            items: [
              "Until you augment it, `keyof RegisterRoute` is `never`, so `push` accepts no path.",
              "`RegisterRoute` is one global registry shared by every Router. A path can type-check while the Router you navigate does not declare it. [Navigation](navigation) covers what happens then.",
              "A navigation to a path that no `Route` in the target Router declares mounts nothing.",
              "Params the pattern does not consume become the query string.",
              "There is no per-`Route` transition. The animation is chosen by each navigation, not by the destination.",
              "If a Router without a `Slot` has children that are not `Route`s, development reports it. Wrap the routes in a `Slot`."
            ]
          },
          { type: "h3", text: "Registering animations" },
          {
            type: "list",
            items: [
              "`transitions` takes `createTransition` or `createRawTransition` output. `decorators` takes `createDecorator` or `createRawDecorator`, `partTransitions` takes `createPartTransition` or `createRawPartTransition`, and `morphTransitions` takes `createMorphTransition` or `createRawMorphTransition`.",
              "Registering transitions, decorators, and part transitions compiles their keyframes into the document. Morph transitions compile to no CSS. Registering one only makes its name available.",
              "A decorator is used only through a transition's `decoratorName`, never set on an element.",
              "A `Part` selects a part transition by name, whatever screen transition is running. A `Morph` selects a morph transition by name."
            ]
          },
          { type: "h3", text: "Where a Router starts" },
          {
            type: "list",
            items: [
              "Only a root browser Router reads the live URL on the client.",
              "On the server, a nested Router, and a memory Router all start from `initPath`.",
              "`initPath` may carry a query, like `/onboarding?step=email`. The route matches the pathname and the params still resolve from the query.",
              "A root Router renders no wrapper and its screens are fixed to the viewport, so `className` and `style` apply only to a nested Router.",
              "History mode is independent of nesting. Nesting only controls the contained box."
            ]
          },
          { type: "h3", text: "Names" },
          {
            type: "list",
            items: [
              "Names must be unique among Routers that enclose one another. A duplicate in one chain is reported in development, because `router` targets would resolve to the nearer one.",
              "Two Routers in different branches may share a name. A lookup only walks the Routers that enclose the call, never a sibling.",
              "With an empty `RegisterRouter`, any string is accepted as a target and a mistyped name is caught in development.",
              "The `name` prop itself stays a plain string, just as `Route`'s `path` is not checked against `RegisterRoute`. A declaration has nothing to check against. A reference does.",
              "A name is only used to find the Router to navigate. It is not the key flemo stores `history.state` under, so renaming a Router never disconnects its existing history entries.",
              "Because you write the name yourself, it is stable across SSR and hydration."
            ]
          },
          { type: "h3", text: "Custom history driver" },
          {
            type: "p",
            text: "`createDriver` receives the Router's key, used to keep each Router's `history.state` separate, and returns a `HistoryDriver`. Wrap `createBrowserHistoryDriver` to map a URL prefix, such as a locale, while the Router works in unprefixed paths. It is ignored when `history` is `memory`."
          },
          {
            type: "code",
            lang: "tsx",
            code: driverCode(
              "Keeps a /ko prefix in the URL while the Router sees unprefixed paths."
            )
          }
        ]
      }
    ]
  },
  ko: {
    slug: "router",
    title: "Router and Route",
    summary:
      "`Router`는 화면 스택 하나와 그 히스토리, 화면 전환을 관리하고, `Route`는 경로 패턴마다 어떤 화면을 렌더링할지 정해요.",
    blocks: [
      { type: "code", lang: "tsx", code: basicCode },
      {
        type: "p",
        text: "`Route`는 `path`를 `element`에 연결해요. `path`에는 경로 배열도 넘길 수 있고, `element`에는 보통 `Screen`을 넣어요. [Slot](slot) 없이 쓰면 Router의 자식이 모두 라우트가 되고, 화면이 뷰포트 전체를 채워요."
      },
      { type: "h", text: "경로 패턴" },
      {
        type: "p",
        text: "경로 매칭에는 path-to-regexp v8을 써요."
      },
      {
        type: "code",
        lang: "ts",
        code: patternsCode(["정확히 일치", "파라미터 하나", "파라미터 여러 개", "와일드카드"])
      },
      { type: "h", text: "타입 안전한 라우트" },
      {
        type: "p",
        text: "`RegisterRoute`를 확장하면 `navigate.push`, `useParams` 같은 훅이 이 타입으로 경로와 파라미터를 검사해요. 파라미터가 없는 라우트는 `undefined`로 적으세요."
      },
      { type: "code", lang: "ts", code: registerCode },
      { type: "code", lang: "tsx", code: typeCheckCode("통과", "타입 에러") },
      {
        type: "note",
        kind: "tip",
        text: "`declare module` 블록은 여러 파일에 나눠 써도 하나로 합쳐져요. 그러니 라우트를 한곳에 모으지 말고 각 화면 파일 맨 아래에서 선언하세요. `RegisterTransition`, `RegisterDecorator`, `RegisterPartTransition`도 같은 방식으로 선언해요."
      },
      { type: "h", text: "Router props" },
      {
        type: "table",
        headers: ["Prop", "기본값", "하는 일"],
        rows: [
          [
            "`defaultTransitionName`",
            "`cupertino`",
            "이동할 때 트랜지션을 따로 지정하지 않으면 쓰는 트랜지션"
          ],
          ["`transitions`", "`[]`", "등록할 커스텀 화면 전환"],
          ["`decorators`", "`[]`", "등록할 커스텀 데코레이터(오버레이)"],
          ["`partTransitions`", "`[]`", "등록할 커스텀 [Part](part) 트랜지션"],
          ["`morphTransitions`", "`[]`", "등록할 커스텀 [Morph](morph) 트랜지션"],
          [
            "`history`",
            "`browser`",
            "`browser`(URL과 뒤로/앞으로 가기 사용) 또는 `memory`(URL 없이 따로 관리)"
          ],
          ["`createDriver`", "없음", "브라우저 히스토리 드라이버를 직접 만든 것으로 바꿔요"],
          [
            "`initPath`",
            "`/`",
            "URL을 읽지 않을 때 시작하는 경로. 서버, 중첩 Router, memory Router에서 써요"
          ],
          ["`name`", "없음", "다른 Router에서 이 Router로 이동할 때 대상을 가리키는 이름"],
          ["`strictRoutes`", "`false`", "라우트 누락 경고를 에러로 바꿔요"],
          ["`className` / `style`", "없음", "중첩 Router 영역의 크기를 정해요"]
        ]
      },
      { type: "h", text: "중첩 Router와 이름" },
      {
        type: "p",
        text: 'Router 안에 넣은 `Router`는 자기만의 화면 스택을 가진 별도 영역이 되고, 화면은 크기를 정해 준 박스 안에서만 움직여요. `history="memory"`를 넘기지 않으면 중첩 Router도 브라우저 히스토리를 써요. 데모, 위저드, 캐러셀처럼 URL에 남길 필요가 없다면 memory를 쓰세요.'
      },
      {
        type: "p",
        text: "카드를 눌러 전체 화면 상세를 여는 것처럼 중첩 Router 안의 코드가 바깥 Router를 움직여야 한다면, 그 Router에 `name`을 붙이세요. 이름으로 대상을 지정하는 방법은 [Navigation](navigation)에서 설명해요."
      },
      { type: "code", lang: "tsx", code: nestedCode, highlight: [1, 8] },
      {
        type: "p",
        text: "이름 등록은 선택이에요. 등록해 두면 등록되지 않은 이름을 `router` 대상으로 쓸 때 컴파일 에러가 나요."
      },
      { type: "code", lang: "ts", code: registerRouterCode },
      { type: "h", text: "서버 사이드 렌더링" },
      {
        type: "p",
        text: "flemo는 마운트된 뒤부터 `window.history`를 직접 제어해요. 서버에는 URL이 없으니 처음 렌더링할 라우트를 `initPath`로 알려 주세요. Vite 같은 순수 SPA라면 필요 없어요."
      },
      {
        type: "code",
        lang: "tsx",
        code: ssrCode(
          "서버에서는 루트 Router가 initPath를 렌더링하고, 클라이언트에서는 URL을 읽어요."
        )
      },
      {
        type: "note",
        kind: "warn",
        text: "라우팅을 직접 처리하는 호스트 프레임워크와는 함께 쓸 수 없어요. 순수 SPA로 쓰거나, 호스트와 라우팅을 공유하지 않는 클라이언트 전용 영역 안에서 쓰세요."
      },
      {
        type: "details",
        title: "예외 상황",
        blocks: [
          { type: "h3", text: "라우트" },
          {
            type: "list",
            items: [
              "`RegisterRoute`를 확장하기 전에는 `keyof RegisterRoute`가 `never`라서 `push`에 어떤 경로도 넘길 수 없어요.",
              "`RegisterRoute`는 모든 Router가 함께 쓰는 전역 레지스트리예요. 그래서 이동하려는 Router에 없는 경로도 타입 검사를 통과할 수 있어요. 그때 어떻게 되는지는 [Navigation](navigation)에서 다뤄요.",
              "대상 Router의 어떤 `Route`에도 없는 경로로 이동하면 아무것도 마운트되지 않아요.",
              "패턴에 쓰이지 않은 파라미터는 쿼리 문자열이 돼요.",
              "`Route`마다 화면 전환을 정할 수는 없어요. 애니메이션은 목적지 화면이 아니라 각 이동에서 정해요.",
              "`Slot` 없는 Router에 `Route`가 아닌 자식이 있으면 개발 환경에서 알려 줘요. 이때는 라우트를 `Slot`으로 감싸세요."
            ]
          },
          { type: "h3", text: "애니메이션 등록" },
          {
            type: "list",
            items: [
              "`transitions`에는 `createTransition`이나 `createRawTransition`으로 만든 값을 넘겨요. 마찬가지로 `decorators`에는 `createDecorator`나 `createRawDecorator`, `partTransitions`에는 `createPartTransition`이나 `createRawPartTransition`, `morphTransitions`에는 `createMorphTransition`이나 `createRawMorphTransition`의 결과를 넘겨요.",
              "화면 트랜지션, 데코레이터, Part 트랜지션은 등록하면 키프레임이 CSS로 컴파일되어 문서에 들어가요. Morph 트랜지션은 CSS를 만들지 않고, 등록하면 이름으로 찾을 수 있게만 돼요.",
              "데코레이터는 요소에 직접 붙이지 않고, 트랜지션의 `decoratorName`으로만 지정해요.",
              "`Part`는 어떤 화면 전환이 실행 중이든 Part 트랜지션을 이름으로 지정하고, `Morph`도 Morph 트랜지션을 이름으로 지정해요."
            ]
          },
          { type: "h3", text: "시작 경로" },
          {
            type: "list",
            items: [
              "클라이언트에서 실제 URL을 읽는 건 루트에 있는 browser Router뿐이에요.",
              "서버에서 렌더링할 때, 그리고 중첩 Router와 memory Router는 모두 `initPath`에서 시작해요.",
              "`initPath`에는 `/onboarding?step=email`처럼 쿼리를 붙일 수 있어요. 라우트는 pathname으로 매칭하고, 파라미터는 쿼리에서도 읽어요.",
              "루트 Router는 감싸는 요소를 렌더링하지 않고 화면이 뷰포트에 고정돼요. 그래서 `className`과 `style`은 중첩 Router에만 적용돼요.",
              "히스토리 모드와 중첩 여부는 서로 관계없어요. 중첩은 화면을 박스 안에 가둘지만 정해요."
            ]
          },
          { type: "h3", text: "이름" },
          {
            type: "list",
            items: [
              "서로 감싸는 관계인 Router끼리는 이름이 겹치면 안 돼요. 한 계층 안에 같은 이름이 있으면 `router` 대상이 더 가까운 쪽으로 정해지기 때문에 개발 환경에서 알려 줘요.",
              "서로 다른 가지에 있는 Router는 이름이 같아도 괜찮아요. 이름은 호출한 곳을 감싸는 Router에서만 찾고, 옆 가지의 Router는 찾지 않아요.",
              "`RegisterRouter`가 비어 있으면 어떤 문자열이든 대상으로 쓸 수 있고, 잘못 쓴 이름은 개발 환경에서 잡아 줘요.",
              "`name` prop 자체는 일반 문자열이에요. `Route`의 `path`를 `RegisterRoute`로 검사하지 않는 것과 같은 이유예요. 이름을 선언하는 곳에는 검사할 기준이 없고, 이름을 참조하는 곳에만 있어요.",
              "이름은 이동할 Router를 찾는 데만 써요. flemo가 `history.state`를 저장하는 키가 아니라서, Router 이름을 바꿔도 기존 히스토리 항목과의 연결이 끊기지 않아요.",
              "이름은 직접 정하는 값이라 SSR과 하이드레이션 사이에서 달라지지 않아요."
            ]
          },
          { type: "h3", text: "커스텀 히스토리 드라이버" },
          {
            type: "p",
            text: "`createDriver`는 Router 키를 받아 `HistoryDriver`를 반환해요. 이 키는 Router마다 `history.state`를 따로 나누는 데 써요. `createBrowserHistoryDriver`를 감싸면 URL에는 로케일 같은 접두사를 붙이고, Router는 접두사 없는 경로만 다루게 할 수 있어요. `history`가 `memory`면 `createDriver`는 무시돼요."
          },
          {
            type: "code",
            lang: "tsx",
            code: driverCode("URL에는 /ko 접두사를 유지하고, Router는 접두사 없는 경로만 다뤄요.")
          }
        ]
      }
    ]
  }
};

export default page;
