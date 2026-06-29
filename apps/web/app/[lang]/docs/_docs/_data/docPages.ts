// Docs content, migrated from the previous MDX docs and refined for the flemo
// zone. Slugs are shared across locales; copy is localized (Korean in a friendly
// 해요체). Inline `code` uses backticks. Examples are framework-neutral. No
// em-dashes.
export type DocBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "code"; lang: "tsx" | "ts" | "bash"; code: string }
  | { type: "list"; items: string[] }
  | { type: "note"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export interface DocPage {
  slug: string;
  title: string;
  blocks: DocBlock[];
}

export interface DocSection {
  title: string;
  pages: DocPage[];
}

const EN: DocSection[] = [
  {
    title: "Getting started",
    pages: [
      {
        slug: "introduction",
        title: "Introduction",
        blocks: [
          { type: "p", text: "flemo is a React router for screen transitions." },
          {
            type: "p",
            text: "Use it when you want a web app that flows screen by screen the way a native app does. Push, pop, the transitions between screens, and swipe-back gestures are all built in. Transitions compile to CSS keyframes. You describe how screens flow in plain React, and flemo handles the rest."
          },
          {
            type: "p",
            text: "The goal is simple: stacking and unstacking screens, the way native apps move, should feel natural in plain React code."
          },
          { type: "h", text: "Where to go next" },
          {
            type: "list",
            items: [
              "`Getting started` install through your first push and pop",
              "`Router & Route` path matching, registration, defaults",
              "`Screen` app bar, navigation bar, safe areas",
              "`Navigation` useNavigate, useParams, useStep",
              "`Transitions` built-in presets, custom transitions, gestures"
            ]
          }
        ]
      },
      {
        slug: "getting-started",
        title: "Getting started",
        blocks: [
          { type: "h", text: "Install" },
          { type: "code", lang: "bash", code: "pnpm add @flemo/react" },
          { type: "h", text: "1. Register your routes" },
          {
            type: "p",
            text: "flemo uses TypeScript module augmentation to make paths and params type-safe. The simplest setup declares every route at the bottom of the file where `Router` is mounted. TypeScript merges declarations across files, so you can also colocate each route with the page that owns it."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterRoute {\n    "/": undefined;\n    "/posts/:slug": { slug: string };\n  }\n}'
          },
          { type: "h", text: "2. Mount the Router" },
          {
            type: "p",
            text: "Render `Router` with a list of `Route`s. Whatever matches the URL becomes the active screen."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Route, Router } from "@flemo/react";\n\nimport Home from "./Home";\nimport Post from "./Post";\n\nexport default function App() {\n  return (\n    <Router>\n      <Route path="/" element={<Home />} />\n      <Route path="/posts/:slug" element={<Post />} />\n    </Router>\n  );\n}'
          },
          { type: "h", text: "3. Build screens and navigate" },
          {
            type: "p",
            text: "Wrap each route's element in `Screen`. Use `useNavigate()` to move between them."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Screen, useNavigate } from "@flemo/react";\n\nexport default function Home() {\n  const navigate = useNavigate();\n  const handleOpen = () => navigate.push("/posts/:slug", { slug: "hello" });\n\n  return (\n    <Screen>\n      <h1>Home</h1>\n      <button onClick={handleOpen}>Open hello</button>\n    </Screen>\n  );\n}'
          },
          {
            type: "p",
            text: "That is the whole loop. Tap Open hello and the post screen slides in (cupertino is the default). Drag from the left edge, or tap Back, and it slides out."
          }
        ]
      }
    ]
  },
  {
    title: "Core",
    pages: [
      {
        slug: "router",
        title: "Router and Route",
        blocks: [
          {
            type: "p",
            text: "`Router` is the root container. It picks which `Route` to render based on the URL."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router>\n  <Route path="/" element={<Home />} />\n  <Route path="/posts/:slug" element={<Post />} />\n</Router>'
          },
          {
            type: "table",
            headers: ["Element", "Job"],
            rows: [
              ["`Router`", "Sets up history, transitions, and decorators"],
              ["`Route`", "Maps a `path` (or paths) to an `element`"]
            ]
          },
          { type: "h", text: "Path patterns" },
          {
            type: "p",
            text: "flemo uses path-to-regexp v8 for matching. Pass an array to share one component across paths."
          },
          {
            type: "code",
            lang: "ts",
            code: '"/"; // exact\n"/posts/:slug"; // a single param\n"/users/:id/posts/:p"; // multiple params\n"/files/*splat"; // wildcard'
          },
          { type: "h", text: "Type-safe routes" },
          {
            type: "p",
            text: "Augment `RegisterRoute` and `navigate.push`, `useParams`, and the rest all type-check against it. Routes without params map to `undefined`; routes with params use the inferred shape."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterRoute {\n    "/": undefined;\n    "/posts/:slug": { slug: string };\n  }\n}'
          },
          {
            type: "code",
            lang: "tsx",
            code: 'navigate.push("/posts/:slug", { slug: "hello" }); // ok\nnavigate.push("/posts/:slug", { id: "1" }); // type error\nnavigate.push("/unknown"); // type error'
          },
          { type: "h", text: "Router options" },
          {
            type: "table",
            headers: ["Prop", "Default", "What it does"],
            rows: [
              ["`initPath`", "`/`", "Path used during SSR before `window.location` is available"],
              ["`defaultTransitionName`", "`cupertino`", "Transition used when a push names none"],
              ["`transitions`", "`[]`", "Custom transitions to register"],
              ["`decorators`", "`[]`", "Custom decorators (overlays) to register"],
              [
                "`history`",
                "`browser`",
                "`browser` (URL + back/forward) or `memory` (isolated, no URL)"
              ]
            ]
          },
          { type: "h", text: "Nested Router and history mode" },
          {
            type: "p",
            text: 'A `Router` inside another is its own region with its own stack. By default it also uses browser history, so the URL updates and browser back/forward work inside it. Pass `history="memory"` for an isolated stack (an embedded demo, a wizard, a carousel) that never touches the URL or the browser\'s back/forward.'
          },
          { type: "h", text: "Server-side rendering" },
          {
            type: "p",
            text: "flemo is a client-side SPA router. It drives `window.history` and takes over navigation once it mounts. The server has no `window.location`, so tell it which route to paint first with `initPath`. On the client, flemo reads `window.location.pathname` and takes over. Pure SPA setups (Vite and friends) do not need `initPath` at all."
          },
          {
            type: "note",
            text: "Because flemo owns client-side history, it does not compose with a host framework that also owns routing. Use it as a pure SPA, or as a self-contained client-only island that does not share routing with the host."
          }
        ]
      },
      {
        slug: "slot",
        title: "Slot",
        blocks: [
          {
            type: "p",
            text: "By default a `Router` transitions the whole viewport. When part of the layout should stay put, like a header, a sidebar, or a bottom tab bar, wrap just the screens in a `Slot`. Everything outside it stays mounted and still while only the screen area animates, so the chrome never slides or re-renders with each navigation."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router>\n  <Header />\n  <Slot className="h-full w-full">\n    <Route path="/" element={<Home />} />\n    <Route path="/about" element={<About />} />\n  </Slot>\n</Router>'
          },
          {
            type: "p",
            text: "Here `Header` mounts once and never moves. Only the screens inside `Slot` slide, and the header's own `useNavigate` drives them with no extra wiring."
          },
          { type: "h", text: "Give it a size" },
          {
            type: "p",
            text: 'The `Slot` is the box your screens animate inside. It clips to its own bounds and stacks the screens with absolute positioning, so without an explicit size it can collapse to zero height and show nothing. Size it from the outside, usually `className="h-full w-full"` to fill its parent.'
          },
          {
            type: "note",
            text: "If a `Router` has children that are not `Route`s (a header, an effect-only component), wrap the routes in a `Slot` so flemo can tell screens from chrome."
          }
        ]
      },
      {
        slug: "screen",
        title: "Screen",
        blocks: [
          {
            type: "p",
            text: "`Screen` is what each route renders. It is a container with slots for app bars, navigation bars, and safe-area aware insets, the same vocabulary you would use building a native app. The content area scrolls by default and the background is white unless you change it."
          },
          { type: "h", text: "App bar and navigation bar" },
          {
            type: "p",
            text: "Two slots, two flavors each. Per-screen bars (`appBar`, `navigationBar`) mount and unmount with the screen. Shared bars (`sharedAppBar`, `sharedNavigationBar`) stay mounted across transitions, so they do not re-animate on every push. Use shared bars for global UI like a bottom tab bar."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  appBar={<TopBar title="Inbox" />}\n  sharedNavigationBar={<TabBar />}\n>\n  <MailList />\n</Screen>'
          },
          { type: "h", text: "Safe areas" },
          {
            type: "p",
            text: "`Screen` reserves the top and bottom safe areas itself through `statusBarHeight` and `systemNavigationBarHeight` (with matching `*Color` and `hide*` props). This matters most inside a native or hybrid WebView app: turn the native safe-area handling off and let the web own the insets, so they animate and recolor with the rest of the screen."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  statusBarHeight="env(safe-area-inset-top)"\n  systemNavigationBarHeight="env(safe-area-inset-bottom)"\n>\n  ...\n</Screen>'
          },
          { type: "h", text: "All props" },
          {
            type: "table",
            headers: ["Prop", "Type", "Default"],
            rows: [
              ["`appBar` / `navigationBar`", "`ReactNode`", "—"],
              ["`sharedAppBar` / `sharedNavigationBar`", "`ReactNode`", "—"],
              ["`backgroundColor`", "`string`", "`white`"],
              ["`statusBarHeight` / `statusBarColor`", "`string`", "—"],
              ["`systemNavigationBarHeight` / `systemNavigationBarColor`", "`string`", "—"],
              ["`hideStatusBar` / `hideSystemNavigationBar`", "`boolean`", "`false`"],
              ["`contentScrollable`", "`boolean`", "`true`"]
            ]
          }
        ]
      },
      {
        slug: "navigation",
        title: "Navigation",
        blocks: [
          {
            type: "p",
            text: "flemo gives you three navigation hooks for different shapes of movement."
          },
          { type: "h", text: "useNavigate" },
          {
            type: "code",
            lang: "ts",
            code: 'const navigate = useNavigate();\n\nnavigate.push("/posts/:slug", { slug: "hello" });\nnavigate.replace("/login");\nnavigate.pop(); // back one screen\nnavigate.pop({ skip: 2 }); // back two screens, one transition\nnavigate.pop({ until: "/posts/:slug" }); // back to the nearest match'
          },
          {
            type: "p",
            text: "`push`, `replace`, and `pop` are async. They wait for the transition to start and the route to take effect, and however far one reaches it drives a single transition."
          },
          { type: "h", text: "Reaching past the top" },
          {
            type: "p",
            text: "All three take an optional distance, `skip` (a number of screens) or `until` (a route pattern), to reach a screen below the top in one transition. Skipped screens are removed without ever painting. They reach the same target and differ only in what they do there."
          },
          {
            type: "table",
            headers: ["Method", "At the reached target"],
            rows: [
              ["`pop`", "lands on it; the target stays"],
              ["`replace`", "replaces it; the target and everything above become the new screen"],
              ["`push`", "keeps it; the new screen stacks on top"]
            ]
          },
          { type: "h", text: "Options" },
          {
            type: "table",
            headers: ["Option", "What it does"],
            rows: [
              [
                "`transitionName`",
                "Override the transition for this navigation (on `pop`, the back animation)"
              ],
              ["`layoutId`", 'Pair with `transitionName: "layout"` for shared-element morphs'],
              ["`skip` / `until`", "Reach past the top in one transition"]
            ]
          },
          { type: "h", text: "useParams" },
          {
            type: "p",
            text: "`useParams<T>()` returns the current route's params, typed against your `RegisterRoute` augmentation. flemo merges path params and query params into one object."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'function Post() {\n  const { slug } = useParams<"/posts/:slug">();\n  return <h1>{slug}</h1>;\n}'
          },
          { type: "h", text: "useStep" },
          {
            type: "p",
            text: "`useStep()` is for sub-states within the current screen. It adds a history entry, so the back button still works, but does not change the route. The same `Screen` stays mounted and only its params update. A multi-step form on one screen is the common case."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'function Onboarding() {\n  const { step = "name" } = useParams<"/onboarding">();\n  const stepper = useStep<"/onboarding">();\n\n  if (step === "name") {\n    return <button onClick={() => stepper.pushStep({ step: "email" })}>Next</button>;\n  }\n  return <button onClick={() => stepper.popStep()}>Back</button>;\n}'
          },
          {
            type: "table",
            headers: ["Method", "What it does"],
            rows: [
              ["`pushStep(params)`", "Push a new history entry with these params, same route"],
              ["`replaceStep(params)`", "Replace the current history entry"],
              ["`popStep()`", "Go back one step"]
            ]
          },
          {
            type: "note",
            text: "`useStep` keeps everything in the screen tree: same Screen instance, same providers, same scroll position. `useNavigate` mounts a new Screen with a real transition."
          }
        ]
      },
      {
        slug: "transitions",
        title: "Transitions",
        blocks: [
          {
            type: "p",
            text: "A transition is the animation between screens. flemo ships four presets and lets you build your own with the same primitives."
          },
          {
            type: "table",
            headers: ["Preset", "Motion"],
            rows: [
              ["`cupertino`", "iOS-style horizontal slide, edge swipe-back included (default)"],
              ["`material`", "Slides up from below, drag-down to dismiss"],
              ["`layout`", "Light fade tuned for layoutId morphs"],
              ["`none`", "Instant cut, no animation"]
            ]
          },
          {
            type: "p",
            text: "Set the global default on `Router`, or override per navigation with `transitionName`."
          },
          { type: "h", text: "Author your own" },
          {
            type: "p",
            text: "`createTransition` describes six phases. flemo compiles them to CSS keyframes, so nothing animates on the JS thread."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createTransition } from "@flemo/react";\n\nexport const myFade = createTransition({\n  name: "myFade",\n  initial: { opacity: 0 },\n  idle: { value: { opacity: 1 }, options: { duration: 0 } },\n  enter: { value: { opacity: 1 }, options: { duration: 0.3 } },\n  enterBack: { value: { opacity: 0 }, options: { duration: 0.3 } },\n  exit: { value: { opacity: 0 }, options: { duration: 0.3 } },\n  exitBack: { value: { opacity: 1 }, options: { duration: 0.3 } }\n});'
          },
          {
            type: "table",
            headers: ["Phase", "When it plays"],
            rows: [
              ["`initial`", "The screen's style before any animation"],
              ["`idle`", "At rest, when no transition is happening"],
              ["`enter` / `exit`", "The active / previous screen during a push or replace"],
              ["`enterBack` / `exitBack`", "The active / previous screen during a pop"]
            ]
          },
          {
            type: "p",
            text: "Register it on the `Router`, then add it to `RegisterTransition` so `transitionName` autocompletes."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router transitions={[myFade]} defaultTransitionName="myFade">\n  ...\n</Router>'
          },
          { type: "h", text: "Raw transitions and swipe" },
          {
            type: "p",
            text: "Use `createRawTransition` when you need different animations for push, replace, and pop on each side. A transition becomes gesture-driven by setting `swipeDirection` and the swipe handlers in `options`."
          },
          { type: "h", text: "Decorators" },
          {
            type: "p",
            text: "A decorator sits between the previous and the current screen. The built-in `overlay` decorator is the dim during a cupertino swipe. Author your own with `createDecorator`, attach it to a transition by `decoratorName`, then register it on the `Router`."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createDecorator } from "@flemo/react";\n\nconst dim = createDecorator({\n  name: "dim",\n  initial: { opacity: 0 },\n  idle: { value: { opacity: 0 }, options: { duration: 0 } },\n  enter: { value: { opacity: 0.4 }, options: { duration: 0.3 } },\n  exit: { value: { opacity: 0 }, options: { duration: 0.3 } }\n});'
          }
        ]
      }
    ]
  },
  {
    title: "Reference",
    pages: [
      {
        slug: "api",
        title: "API reference",
        blocks: [
          { type: "h", text: "Components" },
          {
            type: "table",
            headers: ["Export", "Summary", "Package"],
            rows: [
              ["`Router`", "Root container, renders the active screen", "`@flemo/react`"],
              ["`Route`", "Maps a path (or paths) to an element", "`@flemo/react`"],
              ["`Screen`", "Per-route container with app/nav/safe-area slots", "`@flemo/react`"],
              [
                "`Slot`",
                "Marks the transitioning region, keeping chrome persistent",
                "`@flemo/react`"
              ],
              ["`Layer`", "Portals an overlay out of the content isolation box", "`@flemo/react`"],
              [
                "`LayoutScreen` / `LayoutConfig`",
                "Shared `layoutId` morphs",
                "`@flemo/react-layout`"
              ]
            ]
          },
          { type: "h", text: "Hooks" },
          {
            type: "table",
            headers: ["Export", "Returns"],
            rows: [
              ["`useNavigate()`", "`{ push, replace, pop }`"],
              ["`useParams<T>()`", "The current route's params (path + query merged)"],
              ["`useStep<T>()`", "`{ pushStep, replaceStep, popStep }`"],
              ["`useScreen()`", "Current screen meta (`isActive`, `zIndex`, `params`, ...)"]
            ]
          },
          { type: "h", text: "useScreen fields" },
          {
            type: "table",
            headers: ["Field", "What it is"],
            rows: [
              ["`isActive`", "Whether this is the current (top) screen"],
              ["`isPrev`", "Whether this screen sits below the previous one (frozen)"],
              ["`zIndex`", "Stacking depth; `0` is the root, higher is newer"],
              ["`pathname` / `params`", "The resolved pathname and route params"],
              ["`routePath`", "The matched route pattern, e.g. `/album/:id`"],
              ["`layoutId`", "The screen's `layoutId`, if one was passed"]
            ]
          },
          { type: "h", text: "Factories and built-ins" },
          {
            type: "list",
            items: [
              "`createTransition` / `createRawTransition` author transitions",
              "`createDecorator` / `createRawDecorator` author decorators",
              "Built-in transitions: `cupertino`, `material`, `layout`, `none`",
              "Built-in decorator: `overlay`"
            ]
          },
          { type: "h", text: "Type registries" },
          {
            type: "table",
            headers: ["Interface", "Purpose"],
            rows: [
              ["`RegisterRoute`", "Register routes for type-safe `push` and `useParams`"],
              ["`RegisterTransition`", "Register custom transition names"],
              ["`RegisterDecorator`", "Register custom decorator names"]
            ]
          },
          { type: "h", text: "Peer dependencies" },
          {
            type: "p",
            text: "`@flemo/react` requires only `react ^19` and `react-dom ^19`. `@flemo/react-layout` adds `motion ^12`, installed when you use `LayoutScreen` or `LayoutConfig`."
          }
        ]
      }
    ]
  },
  {
    title: "Experimental",
    pages: [
      {
        slug: "layout-screen",
        title: "LayoutScreen",
        blocks: [
          {
            type: "note",
            text: "`@flemo/react-layout` is experimental. Reach for it only when two screens share an element."
          },
          {
            type: "p",
            text: "`LayoutScreen` is a drop-in replacement for `Screen` that adds shared-element morphing across navigation. A thumbnail in a list unfolds into the hero image on the next screen, then folds back when you go back. It is the gesture iOS uses for photos and Music, and Material 3 calls a container transform."
          },
          {
            type: "p",
            text: "It lives in `@flemo/react-layout`, a separate package, with `motion` as a peer dependency, so apps that do not morph do not pay for it."
          },
          { type: "code", lang: "bash", code: "pnpm add @flemo/react-layout motion" },
          { type: "h", text: "The mental model" },
          {
            type: "table",
            headers: ["Piece", "Job"],
            rows: [
              [
                '`transitionName: "layout"`',
                "Screen-level cross-fade that will not hide the morph"
              ],
              ["`layoutId` (push option)", "The pairing key, made available on the destination"],
              ["`LayoutConfig`", "Aligns motion's layout timing with the screen transition"],
              ["`LayoutScreen`", "Keeps the layoutId pairing alive across unmount"],
              ["`motion.*` + `layoutId`", "Tells motion which DOM nodes are the same"]
            ]
          },
          {
            type: "code",
            lang: "tsx",
            code: 'navigate.push("/photo/:id", { id }, { transitionName: "layout", layoutId: id });'
          },
          { type: "h", text: "A complete example" },
          {
            type: "p",
            text: "The source wraps its morphing tree in `LayoutConfig`, tags each element with a shared `layoutId`, and pushes with the `layout` transition."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Screen, useNavigate } from "@flemo/react";\nimport { LayoutConfig } from "@flemo/react-layout";\nimport { motion } from "motion/react";\n\nfunction Gallery() {\n  const navigate = useNavigate();\n  const open = (p) =>\n    navigate.push("/photos/:id", { id: p.id }, { transitionName: "layout", layoutId: p.id });\n\n  return (\n    <Screen>\n      <LayoutConfig>\n        {photos.map((p) => (\n          <motion.li key={p.id} layoutId={`photo-card-${p.id}`} onClick={() => open(p)}>\n            <motion.img layoutId={`photo-image-${p.id}`} src={p.thumb} />\n          </motion.li>\n        ))}\n      </LayoutConfig>\n    </Screen>\n  );\n}'
          },
          {
            type: "p",
            text: "The destination replaces `Screen` with `LayoutScreen`, reads `useScreen().layoutId` to rebuild the same ids, and morphs a `fixed inset-0` container to fill the viewport."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { useScreen } from "@flemo/react";\nimport { LayoutScreen, LayoutConfig } from "@flemo/react-layout";\nimport { motion } from "motion/react";\n\nfunction Photo() {\n  const { layoutId } = useScreen();\n  const photo = usePhoto(layoutId);\n\n  return (\n    <LayoutScreen>\n      <LayoutConfig>\n        <motion.div layoutId={`photo-card-${layoutId}`} className="fixed inset-0">\n          <motion.img layoutId={`photo-image-${layoutId}`} src={photo.full} />\n        </motion.div>\n      </LayoutConfig>\n    </LayoutScreen>\n  );\n}'
          },
          {
            type: "list",
            items: [
              "Both screens wrap their motion tree in `LayoutConfig`, so each side animates on the same timeline",
              "Every paired element shares a `layoutId` prefix (`photo-card-`, `photo-image-`) with the same id appended",
              "The destination reads `useScreen().layoutId`, the only channel for which card it came from",
              "The destination's container is `fixed inset-0`, which is what creates the unfold to full screen"
            ]
          },
          {
            type: "note",
            text: "The destination's `layoutId` must be identical to the source's for each element. If they differ, motion cannot pair them and the element just fades."
          }
        ]
      }
    ]
  }
];

const KO: DocSection[] = [
  {
    title: "시작하기",
    pages: [
      {
        slug: "introduction",
        title: "소개",
        blocks: [
          { type: "p", text: "flemo는 화면 전환을 위한 React 라우터예요." },
          {
            type: "p",
            text: "네이티브 앱처럼 화면 단위로 흐르는 웹 앱을 만들고 싶을 때 써요. push, pop, 화면 사이 전환, 스와이프 뒤로가기가 모두 내장돼 있어요. 전환은 CSS 키프레임으로 컴파일돼요. 화면이 어떻게 흐르는지 평범한 React로 적으면 나머지는 flemo가 처리해요."
          },
          {
            type: "p",
            text: "목표는 단순해요. 화면을 쌓고 걷어내는 네이티브 앱의 움직임이 평범한 React 코드에서 자연스럽게 느껴지는 것."
          },
          { type: "h", text: "다음으로" },
          {
            type: "list",
            items: [
              "`빠르게 시작하기` 설치부터 첫 push/pop까지",
              "`Router & Route` 경로 매칭, 등록, 기본값",
              "`Screen` 앱 바, 네비게이션 바, 세이프 에어리어",
              "`네비게이션` useNavigate, useParams, useStep",
              "`트랜지션` 내장 프리셋, 커스텀 전환, 제스처"
            ]
          }
        ]
      },
      {
        slug: "getting-started",
        title: "빠르게 시작하기",
        blocks: [
          { type: "h", text: "설치" },
          { type: "code", lang: "bash", code: "pnpm add @flemo/react" },
          { type: "h", text: "1. 라우트 등록" },
          {
            type: "p",
            text: "flemo는 TypeScript 모듈 확장으로 경로와 파라미터를 타입 안전하게 만들어요. 가장 간단한 방법은 `Router`를 마운트하는 파일 맨 아래에 모든 라우트를 선언하는 거예요. TypeScript가 파일 간 선언을 병합하니, 각 라우트를 해당 페이지 파일에 같이 둬도 돼요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterRoute {\n    "/": undefined;\n    "/posts/:slug": { slug: string };\n  }\n}'
          },
          { type: "h", text: "2. Router 마운트" },
          {
            type: "p",
            text: "`Router`에 `Route` 목록을 그려요. URL에 매칭되는 것이 활성 화면이 돼요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Route, Router } from "@flemo/react";\n\nimport Home from "./Home";\nimport Post from "./Post";\n\nexport default function App() {\n  return (\n    <Router>\n      <Route path="/" element={<Home />} />\n      <Route path="/posts/:slug" element={<Post />} />\n    </Router>\n  );\n}'
          },
          { type: "h", text: "3. 화면 만들고 이동하기" },
          {
            type: "p",
            text: "각 라우트의 엘리먼트를 `Screen`으로 감싸요. `useNavigate()`로 화면 사이를 이동해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Screen, useNavigate } from "@flemo/react";\n\nexport default function Home() {\n  const navigate = useNavigate();\n  const handleOpen = () => navigate.push("/posts/:slug", { slug: "hello" });\n\n  return (\n    <Screen>\n      <h1>Home</h1>\n      <button onClick={handleOpen}>Open hello</button>\n    </Screen>\n  );\n}'
          },
          {
            type: "p",
            text: "이게 전부예요. Open hello를 누르면 post 화면이 밀려 들어와요(기본은 cupertino). 왼쪽 끝에서 드래그하거나 Back을 누르면 밀려 나가요."
          }
        ]
      }
    ]
  },
  {
    title: "핵심",
    pages: [
      {
        slug: "router",
        title: "Router와 Route",
        blocks: [
          {
            type: "p",
            text: "`Router`는 루트 컨테이너예요. URL을 보고 어떤 `Route`를 그릴지 골라요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router>\n  <Route path="/" element={<Home />} />\n  <Route path="/posts/:slug" element={<Post />} />\n</Router>'
          },
          {
            type: "table",
            headers: ["요소", "역할"],
            rows: [
              ["`Router`", "히스토리, 전환, 데코레이터를 구성해요"],
              ["`Route`", "`path`(들)를 `element`에 연결해요"]
            ]
          },
          { type: "h", text: "경로 패턴" },
          {
            type: "p",
            text: "flemo는 매칭에 path-to-regexp v8을 써요. 배열을 넘기면 한 컴포넌트를 여러 경로에서 공유해요."
          },
          {
            type: "code",
            lang: "ts",
            code: '"/"; // 정확히 일치\n"/posts/:slug"; // 파라미터 하나\n"/users/:id/posts/:p"; // 여러 파라미터\n"/files/*splat"; // 와일드카드'
          },
          { type: "h", text: "타입 안전 라우트" },
          {
            type: "p",
            text: "`RegisterRoute`를 확장하면 `navigate.push`, `useParams` 등이 그에 맞춰 타입 체크돼요. 파라미터 없는 라우트는 `undefined`로, 있는 라우트는 추론된 형태로 매핑해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'navigate.push("/posts/:slug", { slug: "hello" }); // 통과\nnavigate.push("/posts/:slug", { id: "1" }); // 타입 에러\nnavigate.push("/unknown"); // 타입 에러'
          },
          { type: "h", text: "Router 옵션" },
          {
            type: "table",
            headers: ["Prop", "기본값", "역할"],
            rows: [
              ["`initPath`", "`/`", "`window.location` 전, SSR에서 쓰는 경로"],
              ["`defaultTransitionName`", "`cupertino`", "push가 전환을 안 정했을 때 쓰는 값"],
              ["`transitions`", "`[]`", "등록할 커스텀 전환"],
              ["`decorators`", "`[]`", "등록할 커스텀 데코레이터(오버레이)"],
              [
                "`history`",
                "`browser`",
                "`browser`(URL + 뒤로/앞으로) 또는 `memory`(격리, URL 없음)"
              ]
            ]
          },
          { type: "h", text: "중첩 Router와 history 모드" },
          {
            type: "p",
            text: '`Router` 안의 `Router`는 자기 스택을 가진 독립 영역이에요. 기본적으로 그 안에서도 브라우저 히스토리를 써서 URL이 바뀌고 브라우저 뒤로/앞으로가 동작해요. 임베드된 데모, 위저드, 캐러셀처럼 URL이나 브라우저 뒤로가기를 건드리면 안 되는 격리 스택이 필요하면 `history="memory"`를 주세요.'
          },
          { type: "h", text: "서버 사이드 렌더링" },
          {
            type: "p",
            text: "flemo는 클라이언트 SPA 라우터예요. 마운트되면 `window.history`를 구동하며 네비게이션을 넘겨받아요. 서버엔 `window.location`이 없으니 `initPath`로 첫 화면 경로를 알려줘요. 클라이언트에선 `window.location.pathname`을 읽어 이어받아요. 순수 SPA(Vite 등)는 `initPath`가 아예 필요 없어요."
          },
          {
            type: "note",
            text: "flemo가 클라이언트 히스토리를 소유하기 때문에, 라우팅을 함께 소유하는 호스트 프레임워크와는 같이 못 써요. 순수 SPA나, 라우팅을 호스트와 공유하지 않는 독립 클라이언트 아일랜드로 쓰세요."
          }
        ]
      },
      {
        slug: "slot",
        title: "Slot",
        blocks: [
          {
            type: "p",
            text: "기본적으로 `Router`는 화면 전체를 전환해요. 헤더, 사이드바, 하단 탭 바처럼 레이아웃의 일부가 그대로 머물러야 할 때, 화면들만 `Slot`으로 감싸요. 그러면 `Slot` 바깥은 마운트된 채 가만히 있고 화면 영역만 움직여서, 크롬이 이동할 때마다 미끄러지거나 다시 렌더되지 않아요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router>\n  <Header />\n  <Slot className="h-full w-full">\n    <Route path="/" element={<Home />} />\n    <Route path="/about" element={<About />} />\n  </Slot>\n</Router>'
          },
          {
            type: "p",
            text: "여기서 `Header`는 한 번 마운트되고 움직이지 않아요. `Slot` 안의 화면만 미끄러지고, 헤더의 `useNavigate`가 별도 배선 없이 그 영역을 몰아요."
          },
          { type: "h", text: "크기를 주세요" },
          {
            type: "p",
            text: '`Slot`은 화면들이 그 안에서 움직이는 박스예요. 자기 영역으로 잘라내고 화면들을 absolute로 쌓기 때문에, 크기를 명시하지 않으면 높이가 0으로 줄어 아무것도 안 보일 수 있어요. 보통 부모를 채우도록 바깥에서 `className="h-full w-full"`로 크기를 주세요.'
          },
          {
            type: "note",
            text: "`Router`에 `Route`가 아닌 자식(헤더, 효과 전용 컴포넌트)이 있으면, 라우트들을 `Slot`으로 감싸 flemo가 화면과 크롬을 구분하게 하세요."
          }
        ]
      },
      {
        slug: "screen",
        title: "Screen",
        blocks: [
          {
            type: "p",
            text: "`Screen`은 각 라우트가 그리는 것이에요. 앱 바, 네비게이션 바, 세이프 에어리어 인셋 슬롯을 가진 컨테이너로, 네이티브 앱을 만들 때 쓰는 어휘 그대로예요. 본문은 기본으로 스크롤되고, 배경은 바꾸기 전엔 흰색이에요."
          },
          { type: "h", text: "앱 바와 네비게이션 바" },
          {
            type: "p",
            text: "슬롯 둘, 각각 두 종류예요. 화면별 바(`appBar`, `navigationBar`)는 화면과 함께 마운트·언마운트돼요. 공유 바(`sharedAppBar`, `sharedNavigationBar`)는 전환을 가로질러 유지돼서 push마다 다시 애니메이션되지 않아요. 하단 탭 바 같은 전역 UI에 공유 바를 써요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  appBar={<TopBar title="Inbox" />}\n  sharedNavigationBar={<TabBar />}\n>\n  <MailList />\n</Screen>'
          },
          { type: "h", text: "세이프 에어리어" },
          {
            type: "p",
            text: "`Screen`이 `statusBarHeight`·`systemNavigationBarHeight`(그리고 `*Color`·`hide*`)로 상·하단 세이프 에어리어를 직접 잡아요. 네이티브·하이브리드 WebView 앱에서 특히 중요해요. 네이티브의 세이프 에어리어 처리를 끄고 웹이 인셋을 소유하면, 인셋이 화면과 함께 애니메이션·재색칠돼요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  statusBarHeight="env(safe-area-inset-top)"\n  systemNavigationBarHeight="env(safe-area-inset-bottom)"\n>\n  ...\n</Screen>'
          },
          { type: "h", text: "전체 props" },
          {
            type: "table",
            headers: ["Prop", "타입", "기본값"],
            rows: [
              ["`appBar` / `navigationBar`", "`ReactNode`", "—"],
              ["`sharedAppBar` / `sharedNavigationBar`", "`ReactNode`", "—"],
              ["`backgroundColor`", "`string`", "`white`"],
              ["`statusBarHeight` / `statusBarColor`", "`string`", "—"],
              ["`systemNavigationBarHeight` / `systemNavigationBarColor`", "`string`", "—"],
              ["`hideStatusBar` / `hideSystemNavigationBar`", "`boolean`", "`false`"],
              ["`contentScrollable`", "`boolean`", "`true`"]
            ]
          }
        ]
      },
      {
        slug: "navigation",
        title: "Navigation",
        blocks: [
          { type: "p", text: "flemo는 움직임의 모양에 따라 세 가지 네비게이션 훅을 줘요." },
          { type: "h", text: "useNavigate" },
          {
            type: "code",
            lang: "ts",
            code: 'const navigate = useNavigate();\n\nnavigate.push("/posts/:slug", { slug: "hello" });\nnavigate.replace("/login");\nnavigate.pop(); // 한 화면 뒤로\nnavigate.pop({ skip: 2 }); // 두 화면 뒤로, 전환 한 번\nnavigate.pop({ until: "/posts/:slug" }); // 가장 가까운 매칭으로'
          },
          {
            type: "p",
            text: "`push`, `replace`, `pop`은 async예요. 전환 시작과 라우트 반영을 기다리고, 얼마나 멀리 가든 전환은 한 번만 돌아요."
          },
          { type: "h", text: "위로 건너뛰기" },
          {
            type: "p",
            text: "셋 다 거리 옵션을 받아요. `skip`(화면 수) 또는 `until`(경로 패턴)으로 한 번의 전환에 꼭대기 아래 화면까지 닿아요. 건너뛴 화면은 그려지지 않고 제거돼요. 도착 지점은 같고, 거기서 하는 일만 달라요."
          },
          {
            type: "table",
            headers: ["메서드", "도착 지점에서"],
            rows: [
              ["`pop`", "그 화면에 안착해요. 대상은 남아요"],
              ["`replace`", "대상을 교체해요. 대상과 그 위가 새 화면이 돼요"],
              ["`push`", "대상을 두고, 그 위에 새 화면을 쌓아요"]
            ]
          },
          { type: "h", text: "옵션" },
          {
            type: "table",
            headers: ["옵션", "역할"],
            rows: [
              ["`transitionName`", "이 이동의 전환을 덮어써요(`pop`에선 뒤로 애니메이션)"],
              ["`layoutId`", '`transitionName: "layout"`과 짝지어 공유 요소 모핑'],
              ["`skip` / `until`", "한 번의 전환으로 꼭대기 아래까지"]
            ]
          },
          { type: "h", text: "useParams" },
          {
            type: "p",
            text: "`useParams<T>()`는 현재 라우트의 파라미터를 `RegisterRoute` 확장에 맞춰 타입으로 돌려줘요. flemo는 경로 파라미터와 쿼리 파라미터를 한 객체로 합쳐요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'function Post() {\n  const { slug } = useParams<"/posts/:slug">();\n  return <h1>{slug}</h1>;\n}'
          },
          { type: "h", text: "useStep" },
          {
            type: "p",
            text: "`useStep()`은 현재 화면 안의 하위 상태를 위한 거예요. 히스토리 항목을 추가해서 뒤로가기는 동작하지만 라우트는 안 바뀌어요. 같은 `Screen`이 마운트된 채 파라미터만 갱신돼요. 한 화면의 다단계 폼이 대표적이에요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'function Onboarding() {\n  const { step = "name" } = useParams<"/onboarding">();\n  const stepper = useStep<"/onboarding">();\n\n  if (step === "name") {\n    return <button onClick={() => stepper.pushStep({ step: "email" })}>다음</button>;\n  }\n  return <button onClick={() => stepper.popStep()}>이전</button>;\n}'
          },
          {
            type: "table",
            headers: ["메서드", "역할"],
            rows: [
              ["`pushStep(params)`", "같은 라우트로 새 히스토리 항목"],
              ["`replaceStep(params)`", "현재 항목을 교체"],
              ["`popStep()`", "한 스텝 뒤로"]
            ]
          },
          {
            type: "note",
            text: "`useStep`은 화면 트리를 그대로 둬요. 같은 Screen 인스턴스, 같은 프로바이더, 같은 스크롤 위치. `useNavigate`는 새 Screen을 진짜 전환과 함께 마운트해요."
          }
        ]
      },
      {
        slug: "transitions",
        title: "Transitions",
        blocks: [
          {
            type: "p",
            text: "트랜지션은 화면 사이의 애니메이션이에요. flemo는 프리셋 네 개를 제공하고, 같은 기본 요소로 직접 만들 수도 있어요."
          },
          {
            type: "table",
            headers: ["프리셋", "움직임"],
            rows: [
              ["`cupertino`", "iOS식 가로 슬라이드, 엣지 스와이프 뒤로 포함(기본)"],
              ["`material`", "아래에서 위로, 드래그로 닫기"],
              ["`layout`", "layoutId 모핑에 맞춘 옅은 페이드"],
              ["`none`", "즉시 컷, 애니메이션 없음"]
            ]
          },
          {
            type: "p",
            text: "`Router`에 전역 기본값을 두거나, 이동마다 `transitionName`으로 덮어써요."
          },
          { type: "h", text: "직접 만들기" },
          {
            type: "p",
            text: "`createTransition`은 여섯 단계를 적어요. flemo가 CSS 키프레임으로 컴파일해서 JS 스레드에서 애니메이션이 안 돌아요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createTransition } from "@flemo/react";\n\nexport const myFade = createTransition({\n  name: "myFade",\n  initial: { opacity: 0 },\n  idle: { value: { opacity: 1 }, options: { duration: 0 } },\n  enter: { value: { opacity: 1 }, options: { duration: 0.3 } },\n  enterBack: { value: { opacity: 0 }, options: { duration: 0.3 } },\n  exit: { value: { opacity: 0 }, options: { duration: 0.3 } },\n  exitBack: { value: { opacity: 1 }, options: { duration: 0.3 } }\n});'
          },
          {
            type: "table",
            headers: ["단계", "재생 시점"],
            rows: [
              ["`initial`", "애니메이션 전 화면의 스타일"],
              ["`idle`", "전환이 없을 때의 정지 상태"],
              ["`enter` / `exit`", "push·replace에서 활성/이전 화면"],
              ["`enterBack` / `exitBack`", "pop에서 활성/이전 화면"]
            ]
          },
          {
            type: "p",
            text: "`Router`에 등록하고, `RegisterTransition`에 더해 `transitionName` 자동완성이 되게 해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router transitions={[myFade]} defaultTransitionName="myFade">\n  ...\n</Router>'
          },
          { type: "h", text: "Raw 전환과 스와이프" },
          {
            type: "p",
            text: "push·replace·pop마다, 양쪽마다 다른 애니메이션이 필요하면 `createRawTransition`을 써요. `options`에 `swipeDirection`과 스와이프 핸들러를 주면 제스처로 끌 수 있어요."
          },
          { type: "h", text: "데코레이터" },
          {
            type: "p",
            text: "데코레이터는 이전 화면과 현재 화면 사이에 놓여요. 내장 `overlay`가 cupertino 스와이프 중의 딤이에요. `createDecorator`로 만들고, 전환에 `decoratorName`으로 붙이고, `Router`에 등록해요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createDecorator } from "@flemo/react";\n\nconst dim = createDecorator({\n  name: "dim",\n  initial: { opacity: 0 },\n  idle: { value: { opacity: 0 }, options: { duration: 0 } },\n  enter: { value: { opacity: 0.4 }, options: { duration: 0.3 } },\n  exit: { value: { opacity: 0 }, options: { duration: 0.3 } }\n});'
          }
        ]
      }
    ]
  },
  {
    title: "레퍼런스",
    pages: [
      {
        slug: "api",
        title: "API 레퍼런스",
        blocks: [
          { type: "h", text: "컴포넌트" },
          {
            type: "table",
            headers: ["Export", "요약", "패키지"],
            rows: [
              ["`Router`", "루트 컨테이너, 활성 화면을 그려요", "`@flemo/react`"],
              ["`Route`", "경로(들)를 엘리먼트에 연결", "`@flemo/react`"],
              ["`Screen`", "앱/네비/세이프 에어리어 슬롯을 가진 화면", "`@flemo/react`"],
              ["`Slot`", "전환 영역 표시, 크롬은 지속", "`@flemo/react`"],
              ["`Layer`", "오버레이를 격리 박스 밖으로 portal", "`@flemo/react`"],
              ["`LayoutScreen` / `LayoutConfig`", "공유 `layoutId` 모핑", "`@flemo/react-layout`"]
            ]
          },
          { type: "h", text: "훅" },
          {
            type: "table",
            headers: ["Export", "반환"],
            rows: [
              ["`useNavigate()`", "`{ push, replace, pop }`"],
              ["`useParams<T>()`", "현재 라우트의 파라미터(경로 + 쿼리 병합)"],
              ["`useStep<T>()`", "`{ pushStep, replaceStep, popStep }`"],
              ["`useScreen()`", "현재 화면 메타(`isActive`, `zIndex`, `params`, ...)"]
            ]
          },
          { type: "h", text: "useScreen 필드" },
          {
            type: "table",
            headers: ["필드", "의미"],
            rows: [
              ["`isActive`", "현재(꼭대기) 화면인지"],
              ["`isPrev`", "이전 화면 아래에 있는지(frozen)"],
              ["`zIndex`", "쌓임 깊이. `0`이 루트, 클수록 최신"],
              ["`pathname` / `params`", "해석된 pathname과 라우트 파라미터"],
              ["`routePath`", "매칭된 라우트 패턴, 예: `/album/:id`"],
              ["`layoutId`", "넘겼다면 그 화면의 `layoutId`"]
            ]
          },
          { type: "h", text: "팩토리와 내장" },
          {
            type: "list",
            items: [
              "`createTransition` / `createRawTransition` 전환 제작",
              "`createDecorator` / `createRawDecorator` 데코레이터 제작",
              "내장 전환: `cupertino`, `material`, `layout`, `none`",
              "내장 데코레이터: `overlay`"
            ]
          },
          { type: "h", text: "타입 레지스트리" },
          {
            type: "table",
            headers: ["인터페이스", "용도"],
            rows: [
              ["`RegisterRoute`", "타입 안전한 `push`·`useParams`를 위한 라우트 등록"],
              ["`RegisterTransition`", "커스텀 전환 이름 등록"],
              ["`RegisterDecorator`", "커스텀 데코레이터 이름 등록"]
            ]
          },
          { type: "h", text: "Peer 의존성" },
          {
            type: "p",
            text: "`@flemo/react`는 `react ^19`, `react-dom ^19`만 필요해요. `@flemo/react-layout`은 `motion ^12`를 더하고, `LayoutScreen`이나 `LayoutConfig`를 쓸 때 설치해요."
          }
        ]
      }
    ]
  },
  {
    title: "실험적",
    pages: [
      {
        slug: "layout-screen",
        title: "LayoutScreen",
        blocks: [
          {
            type: "note",
            text: "`@flemo/react-layout`은 실험적이에요. 두 화면이 같은 요소를 공유할 때만 쓰세요."
          },
          {
            type: "p",
            text: "`LayoutScreen`은 `Screen`을 대체하면서 이동 중 공유 요소 모핑을 더해요. 목록의 썸네일이 다음 화면의 큰 이미지로 펼쳐졌다가, 뒤로 가면 다시 접혀요. iOS의 사진·뮤직이 쓰는 동작이고, Material 3은 컨테이너 트랜스폼이라 불러요."
          },
          {
            type: "p",
            text: "별도 패키지 `@flemo/react-layout`에 있고 `motion`이 peer 의존성이라, 모핑을 안 쓰는 앱은 비용을 안 내요."
          },
          { type: "code", lang: "bash", code: "pnpm add @flemo/react-layout motion" },
          { type: "h", text: "멘탈 모델" },
          {
            type: "table",
            headers: ["조각", "역할"],
            rows: [
              ['`transitionName: "layout"`', "모핑을 가리지 않는 화면 레벨 크로스페이드"],
              ["`layoutId` (push 옵션)", "짝짓기 키, 도착 화면에서 사용 가능"],
              ["`LayoutConfig`", "motion의 레이아웃 타이밍을 화면 전환에 맞춤"],
              ["`LayoutScreen`", "언마운트를 가로질러 layoutId 짝을 살려둠"],
              ["`motion.*` + `layoutId`", "어떤 DOM 노드가 같은 것인지 motion에 알려줌"]
            ]
          },
          {
            type: "code",
            lang: "tsx",
            code: 'navigate.push("/photo/:id", { id }, { transitionName: "layout", layoutId: id });'
          },
          { type: "h", text: "전체 예제" },
          {
            type: "p",
            text: "출발 화면은 모핑할 트리를 `LayoutConfig`로 감싸고, 각 요소에 공유 `layoutId`를 달고, `layout` 전환으로 push해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Screen, useNavigate } from "@flemo/react";\nimport { LayoutConfig } from "@flemo/react-layout";\nimport { motion } from "motion/react";\n\nfunction Gallery() {\n  const navigate = useNavigate();\n  const open = (p) =>\n    navigate.push("/photos/:id", { id: p.id }, { transitionName: "layout", layoutId: p.id });\n\n  return (\n    <Screen>\n      <LayoutConfig>\n        {photos.map((p) => (\n          <motion.li key={p.id} layoutId={`photo-card-${p.id}`} onClick={() => open(p)}>\n            <motion.img layoutId={`photo-image-${p.id}`} src={p.thumb} />\n          </motion.li>\n        ))}\n      </LayoutConfig>\n    </Screen>\n  );\n}'
          },
          {
            type: "p",
            text: "도착 화면은 `Screen` 대신 `LayoutScreen`을 쓰고, `useScreen().layoutId`로 같은 id를 다시 만들고, `fixed inset-0` 컨테이너를 화면 가득 모핑해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { useScreen } from "@flemo/react";\nimport { LayoutScreen, LayoutConfig } from "@flemo/react-layout";\nimport { motion } from "motion/react";\n\nfunction Photo() {\n  const { layoutId } = useScreen();\n  const photo = usePhoto(layoutId);\n\n  return (\n    <LayoutScreen>\n      <LayoutConfig>\n        <motion.div layoutId={`photo-card-${layoutId}`} className="fixed inset-0">\n          <motion.img layoutId={`photo-image-${layoutId}`} src={photo.full} />\n        </motion.div>\n      </LayoutConfig>\n    </LayoutScreen>\n  );\n}'
          },
          {
            type: "list",
            items: [
              "두 화면 모두 motion 트리를 `LayoutConfig`로 감싸서 양쪽이 같은 타임라인으로 움직여요",
              "짝이 되는 요소는 같은 `layoutId` 접두사(`photo-card-`, `photo-image-`)에 같은 id를 붙여요",
              "도착 화면은 `useScreen().layoutId`를 읽어요. 어느 카드에서 왔는지 아는 유일한 통로예요",
              "도착 컨테이너가 `fixed inset-0`이라서 화면 가득 펼쳐지는 효과가 나요"
            ]
          },
          {
            type: "note",
            text: "도착의 `layoutId`가 출발과 정확히 같아야 motion이 짝지어요. 다르면 짝을 못 찾아 요소가 그냥 페이드돼요."
          }
        ]
      }
    ]
  }
];

const SECTIONS: Record<string, DocSection[]> = { en: EN, ko: KO };

export function getDocSections(lang: string): DocSection[] {
  return SECTIONS[lang] ?? EN;
}

export function getDocPages(lang: string): DocPage[] {
  return getDocSections(lang).flatMap((section) => section.pages);
}

export function getDocPage(lang: string, slug: string): DocPage | undefined {
  return getDocPages(lang).find((page) => page.slug === slug);
}

// The first paragraph, trimmed to a meta-description length. Powers per-page SEO
// (each doc gets its own <meta name="description">), so search results describe
// the actual page instead of repeating the site tagline.
export function getDocPageDescription(lang: string, slug: string): string | undefined {
  const paragraph = getDocPage(lang, slug)?.blocks.find((block) => block.type === "p");
  if (!paragraph || !("text" in paragraph)) return undefined;
  return paragraph.text.length > 155 ? `${paragraph.text.slice(0, 152)}...` : paragraph.text;
}
