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
          {
            type: "p",
            text: "flemo gives web apps a native-style screen stack: push a screen, pop it, or drag from the edge to go back. Routing and motion are designed as one system."
          },
          { type: "h", text: "The mental model" },
          {
            type: "list",
            items: [
              "`Router` owns the screen history and transition catalog",
              "`Route` maps a path to one screen",
              "`Screen` supplies the visual surface, safe areas, and shared bars",
              "`useNavigate` pushes, replaces, or pops the stack",
              "`Slot` keeps app chrome still while only its screen region moves"
            ]
          },
          {
            type: "p",
            text: "A push creates a real history entry and animates the new Screen over the current one. A pop reveals the screen below it. With the cupertino preset, that same pop is interactive when the user drags from the left edge."
          },
          {
            type: "note",
            text: "flemo is intentionally a screen router, not a replacement for every server-routing feature. It works best in SPAs, hybrid WebViews, and self-contained app regions where Flemo can own client-side history."
          },
          { type: "h", text: "What you get out of the box" },
          {
            type: "list",
            items: [
              "Native-like `cupertino`, `material`, `layout`, and instant `none` transitions",
              "Swipe-back and drag-to-dismiss gestures tied to real history",
              "Shared top and bottom bars that stay visually continuous between screens",
              "Type-safe paths, route params, transition names, and nested Router targets",
              "Custom screen, part, decorator, and shared-element motion"
            ]
          },
          { type: "h", text: "Where to go next" },
          {
            type: "list",
            items: [
              "`Getting started` install through your first push and pop",
              "`Router & Route` path matching, registration, defaults",
              "`Slot` keep part of the layout still while screens transition",
              "`Screen` top bar, bottom bar, safe areas",
              "`Navigation` useNavigate, useParams, useStep",
              "`Transitions` built-in presets, custom transitions, gestures",
              "`Part` give one element its own transition inside a screen"
            ]
          }
        ]
      },
      {
        slug: "getting-started",
        title: "Getting started",
        blocks: [
          {
            type: "p",
            text: "Build the smallest complete Flemo app: two screens, one typed route parameter, and a push that can be popped with the browser Back button or a swipe."
          },
          { type: "h", text: "Install" },
          { type: "code", lang: "bash", code: "pnpm add @flemo/react" },
          {
            type: "note",
            text: "Svelte and SolidJS support is planned."
          },
          { type: "h", text: "1. Mount the Router" },
          {
            type: "p",
            text: "`Router` owns the stack. Each `Route` says which component should become a screen when its path is active."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Route, Router } from "@flemo/react";\n\nimport Home from "./Home";\nimport Post from "./Post";\n\nexport default function App() {\n  return (\n    <Router>\n      <Route path="/" element={<Home />} />\n      <Route path="/posts/:slug" element={<Post />} />\n    </Router>\n  );\n}'
          },
          { type: "h", text: "2. Build a Screen and push" },
          {
            type: "p",
            text: "Every route component renders a `Screen`. Call `navigate.push` with the route pattern and its params. Flemo builds the URL, adds a history entry, and plays the default cupertino transition."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Screen, useNavigate } from "@flemo/react";\n\nexport default function Home() {\n  const navigate = useNavigate();\n\n  return (\n    <Screen>\n      <h1>Home</h1>\n      <button\n        onClick={() =>\n          navigate.push("/posts/:slug", { slug: "hello" })\n        }\n      >\n        Open hello\n      </button>\n    </Screen>\n  );\n}'
          },
          { type: "h", text: "3. Add route types" },
          {
            type: "p",
            text: "Augment `RegisterRoute` once and TypeScript will check every path and params object. A route without params maps to `undefined`; a dynamic route maps to its param shape."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterRoute {\n    "/": undefined;\n    "/posts/:slug": { slug: string };\n  }\n}'
          },
          {
            type: "p",
            text: "That is the complete loop. Tap Open hello to push the post screen. Use browser Back, call `navigate.pop()`, or drag from the left edge to reveal Home again."
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
          {
            type: "note",
            text: "These `declare module` blocks merge: TypeScript folds every `RegisterRoute` augmentation across your codebase into one interface. So prefer declaring each route at the bottom of the file that defines its screen, next to the code it describes, rather than keeping a central registry file. Declare `RegisterTransition`, `RegisterDecorator`, and `RegisterPartTransition` the same way, in the file where you create each one."
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
              ["`partTransitions`", "`[]`", "Custom part transitions to register"],
              [
                "`history`",
                "`browser`",
                "`browser` (URL + back/forward) or `memory` (isolated, no URL)"
              ],
              ["`name`", "none", "Identity for cross-Router navigation, see below"],
              [
                "`strictRoutes`",
                "`false`",
                "Turn the missing-route development warning into an error"
              ]
            ]
          },
          { type: "h", text: "Nested Router and history mode" },
          {
            type: "p",
            text: 'A `Router` inside another is its own region with its own stack. By default it also uses browser history, so the URL updates and browser back/forward work inside it. Pass `history="memory"` for an isolated stack (an embedded demo, a wizard, a carousel) that never touches the URL or the browser\'s back/forward.'
          },
          { type: "h", text: "Naming a Router" },
          {
            type: "p",
            text: "Give a `Router` a `name` when something inside a nested Router needs to move a different one, like a card in a tab region opening a full-screen detail. The name is what `useNavigate` looks up, and it is stable across SSR and hydration because you wrote it yourself."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router name="app">\n  <Route path="/members/:id" element={<Member />} />\n  <Route path={["/region", "/region/people"]} element={<RegionActivity />} />\n</Router>;\n\nfunction RegionActivity() {\n  return (\n    <Router name="region">\n      <RegionHeader />\n      <Slot>\n        <Route path="/region" element={<RegionFeed />} />\n        <Route path="/region/people" element={<RegionPeople />} />\n      </Slot>\n    </Router>\n  );\n}'
          },
          {
            type: "p",
            text: "Names must be unique among the Routers that enclose one another. A duplicate inside one chain is reported in development, because it makes the lookup ambiguous. Two Routers in different branches may share a name: a lookup only ever walks the Routers that actually enclose the call."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterRouter {\n    app: true;\n    region: true;\n  }\n}'
          },
          {
            type: "p",
            text: "Registering is optional, and it decides how `router` type-checks. With an empty `RegisterRouter` any string is accepted, so `name` works without a registry. Once you register names, a `router` target naming no registered Router is a compile error rather than a development-time one. The `name` prop itself stays a plain string, the same way `Route`'s `path` is not constrained by `RegisterRoute`: a declaration has nothing to check against, a reference does."
          },
          {
            type: "note",
            text: "`name` is only a navigation identifier. It is not the key flemo namespaces `history.state` under, so renaming a Router never orphans its history frames."
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
            text: "By default a `Router` transitions the whole viewport. When part of the layout should stay put, like a header, a sidebar, or a bottom tab bar, wrap just the screens in a `Slot`. Everything outside it stays mounted and still while only the screen area animates, so the surrounding layout never slides or re-renders with each navigation."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router>\n  <Header />\n  <Slot className="h-full w-full">\n    <Route path="/" element={<Home />} />\n    <Route path="/about" element={<About />} />\n  </Slot>\n</Router>'
          },
          { type: "h", text: "Give it a size" },
          {
            type: "p",
            text: 'The `Slot` is the box your screens animate inside. It clips ordinary screen content to its own bounds and stacks the screens with absolute positioning, so without an explicit size it can collapse to zero height and show nothing. A `position: fixed` overlay intentionally escapes that region at rest so a sheet or dialog can cover surrounding shared bars; use absolute positioning when an overlay should remain clipped to the Slot. Size the Slot from the outside, usually `className="h-full w-full"` to fill its parent.'
          },
          {
            type: "note",
            text: "If a `Router` has children that are not `Route`s (a header, an effect-only component), wrap the routes in a `Slot` so flemo can tell screens from the surrounding layout."
          }
        ]
      },
      {
        slug: "screen",
        title: "Screen",
        blocks: [
          {
            type: "p",
            text: "`Screen` is what each route renders: a container with slots for a top bar, a bottom bar, and safe-area insets."
          },
          { type: "h", text: "Top bar and bottom bar" },
          {
            type: "p",
            text: "Two slots, two flavors each. Per-screen bars (`topBar`, `bottomBar`) mount and unmount with the screen. Matching shared bars (`sharedTopBar`, `sharedBottomBar`) are kept out of the transition, so they do not animate on every push. Use shared bars for global UI like a bottom tab bar."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  topBar={<TopBar title="Inbox" />}\n  sharedBottomBar={<TabBar />}\n>\n  <MailList />\n</Screen>'
          },
          {
            type: "note",
            text: "A shared bar overlaps with `Slot` (see the previous page), but they fit different cases. `Slot` puts one element, the same on every screen, outside the screen stack, so it never moves with a transition. A shared bar belongs to each screen, but when you move between two screens with matching bars it is left out of the transition and stays in place, so its contents can differ from screen to screen. Use `Slot` for a fixed frame that is identical everywhere, and a shared bar for a per-screen bar that should still look continuous."
          },
          {
            type: "p",
            text: "When the same position serves different roles, label it with `sharedTopBarId` or `sharedBottomBarId`. Bars hand over in place only when both IDs match; different IDs enter and leave with their own screens. Omitting both IDs keeps the legacy position-only behavior."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  sharedBottomBar={<TabBar />}\n  sharedBottomBarId="main-tabs"\n/>\n\n<Screen\n  sharedBottomBar={<BuilderActions />}\n  sharedBottomBarId="pattern-builder-actions"\n/>'
          },
          { type: "h", text: "Safe areas" },
          {
            type: "p",
            text: "`Screen` reserves the top and bottom safe areas itself through `statusBarHeight` and `systemNavigationBarHeight` (with matching `*Color` and `hide*` props). This matters most inside a native or hybrid WebView app: turn the native safe-area handling off and let the web own the insets. Then the safe-area bands transition with the screen, so the whole screen slides and recolors as one piece, instead of content sliding under static native bars that never move and give the WebView away."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  statusBarHeight="env(safe-area-inset-top)"\n  systemNavigationBarHeight="env(safe-area-inset-bottom)"\n>\n  ...\n</Screen>'
          },
          { type: "h", text: "Content and the transition" },
          {
            type: "note",
            text: "A newly mounting screen commits its `children` together with its frame, and the transition anchors its start to that painted first frame, so what slides in is your real content, never an empty shell. If a first render is genuinely heavy, the start is delayed by that work but the motion always plays in full; it is never cut short or skipped."
          },
          { type: "h", text: "All props" },
          {
            type: "table",
            headers: ["Prop", "Type", "Default"],
            rows: [
              ["`topBar` / `bottomBar`", "`ReactNode`", "—"],
              ["`sharedTopBar` / `sharedBottomBar`", "`ReactNode`", "—"],
              ["`sharedTopBarId` / `sharedBottomBarId`", "`string | number`", "—"],
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
            text: "`push`, `replace`, and `pop` return a promise, so you can `await` a move before doing the next thing. It settles once the transition has started and the route has updated. Jumping several screens at once still plays one transition, not one per screen."
          },
          { type: "h", text: "Reaching past the top" },
          {
            type: "p",
            text: "All three take an optional distance, `skip` (a number of screens) or `until` (a route pattern), to reach a screen below the top in one transition. The screens you skip over are removed without ever painting, so they never flash by on the way."
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
              [
                "`layoutId`",
                "Tag this entry with which item opened it, readable as `useScreen().layoutId`"
              ],
              ["`skip` / `until`", "Reach past the top in one transition"],
              ["`router`", "Run this navigation on a different Router, see below"]
            ]
          },
          { type: "h", text: "Choosing which Router moves" },
          {
            type: "p",
            text: "With nested Routers, `useNavigate` drives the nearest one. That is what you want for a move inside a `Slot`, and wrong for a move that should take over the whole screen: the outer layout stays put and only the contained region transitions. Name the target Router and the navigation runs there from the start, on that Router's own history, transition and gestures."
          },
          {
            type: "code",
            lang: "tsx",
            code: '// Inside the nested "region" Router.\nconst navigate = useNavigate();\n\n// Stays in the region Slot.\nnavigate.push("/region/people");\n\n// Takes over the whole screen, on the app Router.\nnavigate.push("/members/:id", { id }, { router: "app" });'
          },
          {
            type: "p",
            text: "A target can also be set once, for every call the hook returns. A per-call `router` overrides the hook default, and both are always resolved from where the hook was called."
          },
          {
            type: "code",
            lang: "ts",
            code: 'const regionNavigate = useNavigate();\nconst appNavigate = useNavigate({ router: "app" });\nconst parentNavigate = useNavigate({ router: "parent" });\n\nappNavigate.push("/members/:id", { id });\nregionNavigate.replace("/region/people", undefined, { transitionName: "tabForward" });\nparentNavigate.pop({ transitionName: "cupertino" });'
          },
          {
            type: "table",
            headers: ["Target", "Which Router it picks"],
            rows: [
              ["omitted / `current`", "The nearest enclosing Router (the default)"],
              ["`parent`", "The Router one level out"],
              ["`root`", "The outermost Router of the current chain"],
              ['`"app"` (a name)', 'The enclosing Router declared with `name="app"`'],
              ["`nearest-owner`", "The first Router, going outwards, that declares the path"]
            ]
          },
          {
            type: "p",
            text: 'A bare string is read as a keyword first and as a Router name second. If a Router is named after a keyword, the object forms are unambiguous: `{ router: { name: "parent" } }` picks the Router named `parent`, `{ router: { scope: "parent" } }` picks the enclosing one.'
          },
          { type: "h", text: "When the route is not there" },
          {
            type: "p",
            text: "`RegisterRoute` is one global registry, so a path can type-check while the Router you are navigating is not the one that declares it. The entry then has no `Route` to mount and the region transitions to nothing, which is the broken half-transition you see when a nested Router is asked to open a full-screen route."
          },
          {
            type: "list",
            items: [
              "You named a Router that does not declare the path: development error",
              "You named a Router that is not in scope, or `parent` at the outermost Router: development error",
              "You left the target implicit and the nearest Router does not declare the path: development warning, behavior unchanged",
              'Pass `strictRoutes` to the `Router` to make that last case an error too, or use `router: "nearest-owner"` to let flemo pick the Router that owns the path'
            ]
          },
          {
            type: "note",
            text: "All of these are development-only. Production never throws over a navigation, so a mistake that slipped through behaves exactly as it did before."
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
            text: "`useStep()` moves between steps inside one screen without navigating away, like a sign-up form going name → email → password. The route and the `Screen` stay the same and only the params change, but each step is its own history entry, so the back button returns to the previous step."
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
              ["`layout`", "Light fade that leaves a shared element room to travel"],
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
            text: "`createTransition` defines six phases."
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
            text: "Each phase's `options` sets the timing. `duration` and `delay` are in seconds, and `ease` takes a keyword (`linear`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `backIn`, `backOut`, `anticipate`) or a four-number cubic-bezier array like `[0.32, 0.72, 0, 1]`."
          },
          {
            type: "p",
            text: "Augment `RegisterTransition` so `transitionName` autocompletes (the same module augmentation as `RegisterRoute`), then register it on the `Router`."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterTransition {\n    myFade: "myFade";\n  }\n}'
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router transitions={[myFade]} defaultTransitionName="myFade">\n  ...\n</Router>'
          },
          { type: "h", text: "What you can animate" },
          {
            type: "p",
            text: "A transition target is not limited to `transform` and `opacity`. It accepts any animatable CSS property, `clipPath`, `filter`, `borderRadius`, `boxShadow`, `color`, custom properties, the whole CSS surface, with TypeScript autocomplete. On top of that it adds transform shortcuts, `x`, `y`, `z`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY`, `rotateZ`, so you can write `{ x: 16 }` instead of the full `translateX`. Bare numbers get sensible units: `px` for lengths, `deg` for rotations, unitless where CSS is unitless."
          },
          {
            type: "p",
            text: "The two endpoints of a value do not have to share the same shape. A `clip-path` can morph between different templates (`inset(0 0 0 100%)` to `inset(0)`), a value can be a `calc()` expression (`calc(100% - 20px)`), and endpoints can mix units (`50%` to `200px`). The library picks the best path to run each value for you; there is no mode to configure."
          },
          {
            type: "p",
            text: "You can also leave a property off one end. `transform` channels and `opacity` fall back to their neutral value (identity, fully opaque); any other property animates from the element's current on-screen value."
          },
          {
            type: "note",
            text: "Values animate with the browser's own CSS interpolation, so a pair that CSS can only change discretely snaps at the midpoint instead of tweening, exactly as native CSS would. A `clip-path` tweens between two `inset()` values, but jumps if the shape function itself changes (`inset()` to `circle()`). Keep both endpoints valid CSS of the same kind."
          },
          {
            type: "p",
            text: "The following `wipe` transition puts this to work. It is a custom transition you author yourself, not a preset. The entering screen is revealed by a `clip-path` that opens left to right, while the screen underneath recedes with a little scale and opacity."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createTransition } from "@flemo/react";\n\nconst EASE = [0.65, 0, 0.35, 1] as const;\n\nconst wipe = createTransition({\n  name: "wipe",\n  initial: { clipPath: "inset(0 0 0 100%)" },\n  idle: { value: { clipPath: "inset(0)", scale: 1, opacity: 1 }, options: { duration: 0 } },\n  enter: { value: { clipPath: "inset(0)" }, options: { duration: 0.45, ease: EASE } },\n  enterBack: { value: { clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.38, ease: EASE } },\n  exit: { value: { scale: 0.96, opacity: 0.8 }, options: { duration: 0.45, ease: EASE } },\n  exitBack: { value: { scale: 1, opacity: 1 }, options: { duration: 0.38, ease: EASE } }\n});'
          },
          {
            type: "p",
            text: "The two `clip-path` endpoints deliberately use different templates, the four-value `inset(0 0 0 100%)` against the `inset(0)` shorthand, and they still tween smoothly."
          },
          { type: "h", text: "Raw transitions" },
          {
            type: "p",
            text: "`createTransition` derives push, replace, and pop from one symmetric set of phases. When that is too coarse, `createRawTransition` is the low-level escape hatch: you spell out the entering and the leaving screen for every operation, so push can move differently from replace or pop."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createRawTransition } from "@flemo/react";\n\nexport const shove = createRawTransition({\n  name: "shove",\n  initial: { transform: "translateX(100%)" },\n  idle: { value: { transform: "translateX(0)" }, options: { duration: 0 } },\n  pushOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0.4 } },\n  pushOnExit: { value: { transform: "translateX(-30%)" }, options: { duration: 0.4 } },\n  replaceOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0.4 } },\n  replaceOnExit: { value: { transform: "translateX(-100%)" }, options: { duration: 0.4 } },\n  popOnEnter: { value: { transform: "translateX(-30%)" }, options: { duration: 0.4 } },\n  popOnExit: { value: { transform: "translateX(100%)" }, options: { duration: 0.4 } },\n  completedOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0 } },\n  completedOnExit: { value: { transform: "translateX(0)" }, options: { duration: 0 } }\n});'
          },
          { type: "h", text: "Swipe" },
          {
            type: "p",
            text: 'Any transition, preset or custom, becomes gesture-driven by setting `swipeDirection` (`"x"` or `"y"`) and three handlers in `options`. During the drag the handlers own the screens: flemo hands them the pointer data and both screen elements, and they move the screens, report progress, and decide the outcome. The built-in cupertino edge swipe-back is exactly this wiring.'
          },
          {
            type: "table",
            headers: ["Hook", "Signature", "Role"],
            rows: [
              [
                "`onSwipeStart`",
                "`(event, info, { animate, currentScreen, prevScreen, onStart })`",
                "Accept or ignore the gesture: return `true` to begin the swipe, `false` to leave the drag alone"
              ],
              [
                "`onSwipe`",
                "`(event, info, { animate, currentScreen, prevScreen, onProgress })`",
                "Fires every drag frame. Move both screens, compute a progress from 0 to 100, report it through `onProgress`, and return it"
              ],
              [
                "`onSwipeEnd`",
                "`(event, info, { animate, currentScreen, prevScreen, onStart })`",
                "Decide the commit from `info.offset` and `info.velocity`, relay the verdict through `onStart`, settle both screens, and return the verdict"
              ]
            ]
          },
          {
            type: "list",
            items: [
              "`info` is `{ point, offset, velocity, delta }`, each an `{ x, y }` pair",
              "`animate(element, target, options?)` writes values to a screen. Pass `{ duration: 0 }` to follow the finger, and a short duration with an `ease` to settle",
              "The `progress` you report through `onProgress` is what drives the transition's decorator and every `Part` on both screens, so one gesture moves the whole scene (see the Part page)",
              "Return `true` from `onSwipeEnd` and flemo completes the back navigation without replaying the pop animation, since the swipe already played it. Return `false` and everything returns to rest"
            ]
          },
          {
            type: "p",
            text: "This is cupertino's actual `options` block. The `linear` helper maps the drag offset onto a 0 to 100 progress, and the three handlers do the rest."
          },
          {
            type: "code",
            lang: "ts",
            code: 'const linear = (value: number, from: [number, number], to: [number, number]) => {\n  const [fromMin, fromMax] = from;\n  const [toMin, toMax] = to;\n  if (fromMax === fromMin) return toMin;\n  const t = (value - fromMin) / (fromMax - fromMin);\n  return toMin + t * (toMax - toMin);\n};\n\nconst cupertino = createTransition({\n  name: "cupertino",\n  // ...phases\n  options: {\n    decoratorName: "overlay",\n    swipeDirection: "x",\n    onSwipeStart: async () => {\n      return true;\n    },\n    onSwipe: (_, info, { animate, currentScreen, prevScreen, onProgress }) => {\n      const { offset } = info;\n      const dragX = offset.x;\n      const progress = linear(dragX, [0, window.innerWidth], [0, 100]);\n\n      onProgress?.(true, progress);\n\n      animate(currentScreen, { x: Math.max(0, dragX) }, { duration: 0 });\n      animate(prevScreen, { x: `${-35 + progress * 0.35}%` }, { duration: 0 });\n\n      return progress;\n    },\n    onSwipeEnd: async (_, info, { animate, currentScreen, prevScreen, onStart }) => {\n      const { offset, velocity } = info;\n      const dragX = offset.x;\n      const isTriggered = dragX > 50 || velocity.x > 20;\n\n      onStart?.(isTriggered);\n\n      await Promise.all([\n        animate(currentScreen, { x: isTriggered ? "100%" : 0 }, { duration: 0.3, ease: [0.32, 0.72, 0, 1] }),\n        animate(prevScreen, { x: isTriggered ? 0 : "-35%" }, { duration: 0.3, ease: [0.32, 0.72, 0, 1] })\n      ]);\n\n      return isTriggered;\n    }\n  }\n});'
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
          },
          {
            type: "p",
            text: "Augment `RegisterDecorator` for the typed name."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterDecorator {\n    dim: "dim";\n  }\n}'
          },
          {
            type: "p",
            text: "A transition opts into the decorator with `decoratorName`, and both go on the `Router`."
          },
          {
            type: "code",
            lang: "ts",
            code: 'const dive = createTransition({\n  name: "dive",\n  // ...phases\n  options: { decoratorName: "dim" }\n});'
          },
          {
            type: "code",
            lang: "tsx",
            code: "<Router transitions={[dive]} decorators={[dim]}>\n  ...\n</Router>"
          }
        ]
      },
      {
        slug: "part",
        title: "Part",
        blocks: [
          {
            type: "p",
            text: "`Part` gives one element inside a screen its own animation, driven by the screen's lifecycle and timed with its transition, but applied to just that one element. The classic use is a pinned shared bar whose title drifts and fades as you move between screens, while the rest of the bar stays put."
          },
          {
            type: "p",
            text: "`Part` renders a wrapper `<div>` around its children. Its one own prop is `name`, the registered part transition to run; everything else is a normal `div` prop (`className`, `style`, `ref`, children), so you style and position it like any element. Only the wrapped element animates. Everything else on the bar or the screen stays where it is."
          },
          { type: "h", text: "Author the part transition" },
          {
            type: "p",
            text: "Create the transition with `createPartTransition`, then augment `RegisterPartTransition` for a typed `name` (the same module augmentation as `RegisterRoute`). A part collapses the screen lifecycle to three rest states."
          },
          {
            type: "table",
            headers: ["State", "When it applies"],
            rows: [
              ["`initial`", "The element's style before any animation"],
              ["`idle`", "The screen is active and at rest, or entering as the new top screen"],
              [
                "`enter`",
                "The screen is moving into the background during a push or replace, and staying there"
              ],
              ["`exit`", "The previously-behind screen returning to active during a pop"]
            ]
          },
          {
            type: "p",
            text: "Where `createTransition` spells out five states (`idle`, `enter`, `enterBack`, `exit`, `exitBack`), a part collapses to three. On a programmatic push, replace, or pop the part animates in lockstep with its screen's transition automatically, with no per-frame code from you."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createPartTransition } from "@flemo/react";\n\nconst EASE = [0.32, 0.72, 0, 1] as const;\n\nconst panelTitle = createPartTransition({\n  name: "panel-title",\n  initial: { opacity: 1, y: 0 },\n  idle: { value: { opacity: 1, y: 0 }, options: { duration: 0 } },\n  enter: { value: { opacity: 0.35, y: -10 }, options: { duration: 0.6, ease: EASE } },\n  exit: { value: { opacity: 1, y: 0 }, options: { duration: 0.6, ease: EASE } }\n});'
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterPartTransition {\n    "panel-title": "panel-title";\n  }\n}'
          },
          {
            type: "p",
            text: "Register it on the `Router`, the same as `transitions` and `decorators`."
          },
          {
            type: "code",
            lang: "tsx",
            code: "<Router partTransitions={[panelTitle]}>\n  ...\n</Router>"
          },
          {
            type: "p",
            text: "Then wrap the element in `Part`."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Part, Screen } from "@flemo/react";\n\nfunction Panel() {\n  return (\n    <Screen sharedTopBar={<header><Part name="panel-title">Inbox</Part></header>}>\n      <MailList />\n    </Screen>\n  );\n}'
          },
          { type: "h", text: "Follow the swipe" },
          {
            type: "p",
            text: "That is the resting animation, and it is all a programmatic push or pop needs. During an interactive swipe (like cupertino's edge swipe-back) a part without swipe hooks still lands correctly when the swipe commits, but it only settles at the end instead of tracking the finger. To make it follow the drag, add swipe hooks in `options`."
          },
          {
            type: "p",
            text: "Parts take the same three hooks, `onSwipeStart`, `onSwipe`, and `onSwipeEnd`, in a per-element form. Each receives `(triggered, { animate, element, active })`, and `onSwipe` additionally gets the drag `progress` from 0 to 100, the same progress the screen transition reports (see the Transitions page). There is no pointer event and no screens here, just the wrapped `element`, `animate` to write to it, and `active` telling whether it sits on the current top screen (`true`) or the previous screen being revealed (`false`). The rhythm matches the screen hooks: `{ duration: 0 }` in `onSwipe` to follow the finger, and a short settle in `onSwipeEnd` where `triggered` says whether the swipe committed."
          },
          {
            type: "code",
            lang: "ts",
            code: 'const panelTitle = createPartTransition({\n  name: "panel-title",\n  initial: { opacity: 1, y: 0 },\n  idle: { value: { opacity: 1, y: 0 }, options: { duration: 0 } },\n  enter: { value: { opacity: 0.35, y: -10 }, options: { duration: 0.6, ease: EASE } },\n  exit: { value: { opacity: 1, y: 0 }, options: { duration: 0.6, ease: EASE } },\n  options: {\n    onSwipe: (_, progress, { animate, element, active }) => {\n      if (active) return;\n      const recovered = Math.min(1, Math.max(0, progress / 100));\n      animate(\n        element,\n        { opacity: 0.35 + 0.65 * recovered, y: -10 * (1 - recovered) },\n        { duration: 0 }\n      );\n    },\n    onSwipeEnd: (triggered, { animate, element, active }) => {\n      if (active) return;\n      animate(element, triggered ? { opacity: 1, y: 0 } : { opacity: 0.35, y: -10 }, {\n        duration: 0.3,\n        ease: EASE\n      });\n    }\n  }\n});'
          },
          {
            type: "p",
            text: "The `if (active) return;` at the top of each hook is the key move. During a swipe-back the top screen is leaving and the previous screen is coming back, so only the previous screen's part needs to recover with the drag. The active side just rides its own screen untouched, so its hooks bail out early. `onSwipe` maps the drag `progress` onto the title's opacity and offset every frame, and `onSwipeEnd` settles the rest based on whether the swipe committed."
          },
          {
            type: "note",
            text: "For finer control over each operation, `createRawPartTransition` exposes every status the way `createRawTransition` does: `idle`, `pushOnEnter` / `pushOnExit`, `replaceOnEnter` / `replaceOnExit`, `popOnEnter` / `popOnExit`, and `completedOnEnter` / `completedOnExit`."
          }
        ]
      },
      {
        slug: "layer",
        title: "Layer",
        blocks: [
          {
            type: "p",
            text: "`Layer` renders an overlay beside its screen instead of inside it, so the overlay can cover the shared bars and survive the screen moving underneath it. A bottom sheet that has to dim the tab bar is the classic use."
          },
          { type: "h", text: "Why an overlay cannot do this from inside" },
          {
            type: "p",
            text: 'A screen that is moving carries a transform, and a transform is both a containing block for `position: fixed` descendants and a stacking context around everything inside it. The shared bars live outside the screen, as siblings. So an overlay written inside the screen is one atom with the screen\'s content as far as the bars are concerned, and "content under the bar, sheet over the bar" is not expressible from in there at any z-index. `Layer` portals the overlay to a host beside the screens, and that is the whole trick: only the paint order leaves the screen.'
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Layer, Screen } from "@flemo/react";\n\nfunction Inbox() {\n  const [open, setOpen] = useState(false);\n\n  return (\n    <Screen sharedBottomBar={<TabBar />}>\n      <MailList onCompose={() => setOpen(true)} />\n      <Layer>\n        <ComposeSheet open={open} onClose={() => setOpen(false)} />\n      </Layer>\n    </Screen>\n  );\n}'
          },
          {
            type: "p",
            text: "The overlay still belongs to its screen. It keeps the screen's stack position, status, and transition, so it moves with the screen during a navigation and leaves with it on a pop; React freezes it with the screen and unmounts it with the screen. Children keep whatever positioning they had, so a sheet written with `position: fixed; bottom: 0` works unchanged."
          },
          { type: "h", text: "When you do not need it" },
          {
            type: "p",
            text: "A screen at rest carries no transform, so a plain `position: fixed` overlay already resolves against the viewport and can outrank the bars with a z-index of its own. Reach for `Layer` when the overlay has to survive the screen moving under it, or has to clear chrome an ancestor screen declared."
          },
          {
            type: "note",
            text: "`Layer` renders nothing on the server and on the first client render, before its host mounts. The host belongs to the outermost screen, which is the root `Router`'s viewport-sized region: inside a nested `Router`, an overlay's `bottom: 0` resolves against that outer region, not against the nested box."
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
              [
                "`Screen`",
                "Per-route container with top/bottom bar and safe-area slots",
                "`@flemo/react`"
              ],
              [
                "`Slot`",
                "Marks the transitioning region, keeping the surrounding layout persistent",
                "`@flemo/react`"
              ],
              [
                "`Part`",
                "Runs a named part transition on one element inside a screen",
                "`@flemo/react`"
              ],
              [
                "`Morph`",
                "A shared element: one thing on two screens, paired by `layoutId`",
                "`@flemo/react`"
              ]
            ]
          },
          { type: "h", text: "Hooks" },
          {
            type: "table",
            headers: ["Export", "Returns"],
            rows: [
              ["`useNavigate(options?)`", "`{ push, replace, pop }`, optionally bound to a Router"],
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
              ["`isRoot`", "Whether this is the root screen of its stack"],
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
              "`createPartTransition` / `createRawPartTransition` author part transitions",
              "`createMorphTransition` / `createRawMorphTransition` author shared-element morphs",
              "Built-in transitions: `cupertino`, `material`, `layout`, `none`",
              "Built-in decorator: `overlay`",
              "Built-in morph: `shared`"
            ]
          },
          { type: "h", text: "Type registries" },
          {
            type: "table",
            headers: ["Interface", "Purpose"],
            rows: [
              ["`RegisterRoute`", "Register routes for type-safe `push` and `useParams`"],
              ["`RegisterRouter`", "Register Router names for type-safe `router` targets"],
              ["`RegisterTransition`", "Register custom transition names"],
              ["`RegisterDecorator`", "Register custom decorator names"],
              ["`RegisterPartTransition`", "Register custom part transition names"],
              ["`RegisterMorphTransition`", "Register custom morph transition names"]
            ]
          },
          { type: "h", text: "Peer dependencies" },
          {
            type: "p",
            text: "`@flemo/react` requires only `react ^19` and `react-dom ^19`. Nothing else, shared-element morphs included: they used to need `@flemo/react-layout` and `motion`, and now they are `<Morph>` in the same package."
          }
        ]
      }
    ]
  },
  {
    title: "Shared elements",
    pages: [
      {
        slug: "morph",
        title: "Morph",
        blocks: [
          {
            type: "p",
            text: "`<Morph>` marks an element that exists on two screens. Give both sides the same `layoutId` and flemo treats them as one thing: the arriving element starts where its partner was, the two trade places while they are still on top of each other, and it lands exactly where its own layout puts it."
          },
          {
            type: "note",
            text: "A morph needs no special screen and no particular transition. Keep the one you chose: for the length of the flight the element is staged ABOVE both screens, so whatever they are doing (fading, sliding, cutting) cannot clip it, cover it or carry it along."
          },
          { type: "h", text: "The source" },
          {
            type: "p",
            text: "Wrap the element you want to travel. The `layoutId` is the whole pairing: there is no push option to remember and no `Screen` to swap out."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Morph, Screen, useNavigate } from "@flemo/react";\n\nfunction Gallery() {\n  const { push } = useNavigate();\n\n  return (\n    <Screen>\n      <ul>\n        {photos.map((photo) => (\n          <li key={photo.id}>\n            <Morph\n              layoutId={`photo-${photo.id}`}\n              onClick={() => push("/photos/:id", { id: photo.id })}\n            >\n              <img src={photo.thumb} alt="" />\n            </Morph>\n          </li>\n        ))}\n      </ul>\n    </Screen>\n  );\n}'
          },
          { type: "h", text: "The destination" },
          {
            type: "p",
            text: "The same `layoutId`, wherever that element belongs on the arriving screen."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Morph, Screen, useParams } from "@flemo/react";\n\nfunction Photo() {\n  const { id } = useParams<{ id: string }>();\n\n  return (\n    <Screen>\n      <Morph layoutId={`photo-${id}`} className="hero">\n        <img src={photoById(id).full} alt="" />\n      </Morph>\n    </Screen>\n  );\n}'
          },
          { type: "h", text: "What it does" },
          {
            type: "list",
            items: [
              "The source's box is measured the instant the navigation starts, while it is still where you last saw it",
              "It leaves its screen for the flight and returns on landing, so no scroll container, no opaque arrival and no sliding transition can get in the way of the travel",
              "It lands on its real layout box, so the resting frame is pixel-exact by construction",
              "Its corner radius is carried across, pre-divided by the scale so it reads at its authored size on both ends"
            ]
          },
          {
            type: "note",
            text: "Both sides must be mounted when the navigation starts, because a morph pairs elements, not routes. The element itself is moved out of your tree for the length of the flight and put back exactly as it was, so avoid measuring or mutating it from outside during a navigation."
          },
          { type: "h", text: "Nesting" },
          {
            type: "p",
            text: "Morphs nest, and a nested one RIDES its container. Make the card a `<Morph>` and the artwork inside it another, and the card is what travels. The artwork goes with it, staying exactly where it belongs on the card the whole way. That is deliberate: letting both fly on their own curves is what tears a card apart mid-flight, with the artwork drifting out of the box it is supposed to be inside. The container is the unit the eye follows."
          },
          {
            type: "note",
            text: 'A morph is a transform, so a heading that grows from 14px to 24px scales its glyphs rather than re-typesetting them. Use the built-in `text` preset (`<Morph name="text">`) for type: it scales by the LINE BOX and pins the start edge. Anchoring text to its WIDTH is the trap: a text block is as wide as whatever contains it, so the width ratio says nothing about the type size and the text bulges past its target before shrinking back into it.'
          },
          { type: "h", text: "When the element IS the screen" },
          {
            type: "p",
            text: "A container that grows to fill the viewport is the same feature with a bigger box, and what happens behind it is the SCREEN transition's business, not the morph's. Author the screen to follow the element on its way out (`exit: { scale: 1.08, filter: \"blur(10px)\" }`: the element is opening OUT, so what is behind it pushes out too), leave the arriving screen transparent so it shows through, and the element opens over a background that moves with it. The two stay in step for free: a morph with no duration of its own inherits the flying screen's, and one hold releases both on the same frame."
          },
          { type: "h", text: "Authoring the morph" },
          {
            type: "p",
            text: "A morph is a transition like every other one in flemo. `createMorphTransition` takes the same shape as `createTransition`, an `initial` plus the enter and exit sides. Register it on the `Router` and reference it by name."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { createMorphTransition, Morph, Router } from "@flemo/react";\n\nconst unfold = createMorphTransition({\n  name: "unfold",\n  initial: { opacity: 0 },\n  idle: { value: { opacity: 1 }, options: { duration: 0 } },\n  enter: { value: { opacity: 1 }, options: { duration: 0.45, ease: [0.32, 0.72, 0, 1] } },\n  exit: { value: { opacity: 0 }, options: { duration: 0.45 } },\n  options: { crossFade: 0.25 }\n});\n\n<Router morphTransitions={[unfold]}>...</Router>;\n\n<Morph layoutId={`photo-${id}`} name="unfold" />;'
          },
          {
            type: "p",
            text: "The travel itself is not authored: it is measured per flight. What you write is everything else: the timing, the fade, an optional transform flourish that composes on top of the travel."
          },
          {
            type: "table",
            headers: ["Option", "What it does"],
            rows: [
              [
                "`crossFade`",
                "Share of the flight over which the two sides hand over (0-1, default 0.12)"
              ],
              [
                "`scale`",
                "`box` matches the partner per axis; `width` / `height` scale by one ratio and distort nothing; `none` only moves"
              ],
              [
                "`anchor`",
                "Which point the two boxes share: `centre`, or `start` for left-aligned content"
              ],
              [
                "`radius`",
                "Interpolate `border-radius` with scale-corrected endpoints (default true)"
              ],
              [
                "`enter` / `exit`",
                "The arriving element and the one it replaces, animating at the same time"
              ],
              [
                "`options.duration`",
                "Omit it and the morph inherits the flying screen's, so it lands with the screen"
              ]
            ]
          },
          {
            type: "note",
            text: "The built-in `shared` preset authors no duration on purpose. That is what lets one morph look right under any transition you pair it with."
          },
          { type: "h", text: "Coming from @flemo/react-layout" },
          {
            type: "p",
            text: '`@flemo/react-layout` and its `motion` peer dependency are gone. `LayoutScreen` is now plain `Screen` (flemo keeps a screen carrying a travelling element from painting over its partner on its own), `LayoutConfig` has no job left because the timing is flemo\'s already, and each `motion.div layoutId="x"` becomes `<Morph layoutId="x">`.'
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
          {
            type: "p",
            text: "flemo는 웹 앱에 네이티브 방식의 화면 스택을 만들어요. 화면을 push하고 pop하거나, 화면 가장자리를 끌어 뒤로 갈 수 있어요. 라우팅과 움직임을 하나의 시스템으로 다뤄요."
          },
          { type: "h", text: "먼저 이해할 구조" },
          {
            type: "list",
            items: [
              "`Router`가 화면 히스토리와 트랜지션 목록을 관리해요",
              "`Route`가 경로 하나와 화면 하나를 연결해요",
              "`Screen`이 화면 표면, 세이프 에어리어, 공유 바를 만들어요",
              "`useNavigate`로 스택을 push, replace, pop해요",
              "`Slot`은 앱 바 같은 크롬을 고정하고 화면 영역만 움직여요"
            ]
          },
          {
            type: "p",
            text: "push하면 실제 히스토리 항목이 생기고 새 Screen이 현재 화면 위로 들어와요. pop하면 아래 화면이 다시 드러나요. cupertino 프리셋에서는 왼쪽 가장자리를 끄는 동작이 그대로 인터랙티브 pop이 돼요."
          },
          {
            type: "note",
            text: "flemo는 모든 서버 라우팅 기능을 대신하는 도구가 아니라 화면 라우터예요. SPA, 하이브리드 WebView, 또는 Flemo가 클라이언트 히스토리를 맡을 수 있는 독립 앱 영역에 가장 잘 맞아요."
          },
          { type: "h", text: "기본으로 얻는 것" },
          {
            type: "list",
            items: [
              "네이티브 같은 `cupertino`, `material`, `layout`, 즉시 전환 `none`",
              "실제 히스토리와 연결된 스와이프 뒤로 가기와 드래그 닫기",
              "화면 사이에서 자연스럽게 이어지는 공유 상단·하단 바",
              "경로, 파라미터, 트랜지션 이름, 중첩 Router 대상의 타입 안전성",
              "화면, Part, decorator, 공유 요소를 위한 커스텀 모션"
            ]
          },
          { type: "h", text: "다음으로" },
          {
            type: "list",
            items: [
              "`빠르게 시작하기` 설치부터 첫 push/pop까지",
              "`Router와 Route` 경로 매칭, 등록, 기본값",
              "`Slot` 화면이 전환되는 동안 레이아웃 일부는 그대로 두기",
              "`Screen` 상단 바, 하단 바, 세이프 에어리어",
              "`Navigation` useNavigate, useParams, useStep",
              "`Transitions` 내장 프리셋, 커스텀 트랜지션, 제스처",
              "`Part` 화면 안 한 요소에 자기만의 전환 주기"
            ]
          }
        ]
      },
      {
        slug: "getting-started",
        title: "빠르게 시작하기",
        blocks: [
          {
            type: "p",
            text: "화면 두 개와 타입이 있는 경로 파라미터 하나로 가장 작은 Flemo 앱을 만들어요. push한 화면은 브라우저 뒤로 가기나 스와이프로 다시 pop할 수 있어요."
          },
          { type: "h", text: "설치" },
          { type: "code", lang: "bash", code: "pnpm add @flemo/react" },
          {
            type: "note",
            text: "Svelte, SolidJS 지원도 준비 중이에요."
          },
          { type: "h", text: "1. Router 마운트" },
          {
            type: "p",
            text: "`Router`가 화면 스택을 관리해요. 각 `Route`는 경로가 활성화됐을 때 어떤 컴포넌트를 화면으로 보여줄지 정해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Route, Router } from "@flemo/react";\n\nimport Home from "./Home";\nimport Post from "./Post";\n\nexport default function App() {\n  return (\n    <Router>\n      <Route path="/" element={<Home />} />\n      <Route path="/posts/:slug" element={<Post />} />\n    </Router>\n  );\n}'
          },
          { type: "h", text: "2. Screen을 만들고 push" },
          {
            type: "p",
            text: "각 라우트 컴포넌트는 `Screen`을 그려요. `navigate.push`에 경로 패턴과 파라미터를 넘기면 Flemo가 URL과 히스토리 항목을 만들고 기본 cupertino 전환을 재생해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Screen, useNavigate } from "@flemo/react";\n\nexport default function Home() {\n  const navigate = useNavigate();\n\n  return (\n    <Screen>\n      <h1>Home</h1>\n      <button\n        onClick={() =>\n          navigate.push("/posts/:slug", { slug: "hello" })\n        }\n      >\n        Open hello\n      </button>\n    </Screen>\n  );\n}'
          },
          { type: "h", text: "3. 경로 타입 추가" },
          {
            type: "p",
            text: "`RegisterRoute`를 한 번 확장하면 TypeScript가 모든 경로와 파라미터 객체를 검사해요. 파라미터 없는 경로는 `undefined`, 동적 경로는 파라미터 형태를 적어요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterRoute {\n    "/": undefined;\n    "/posts/:slug": { slug: string };\n  }\n}'
          },
          {
            type: "p",
            text: "이제 전체 흐름이 완성됐어요. Open hello를 누르면 post 화면이 push돼요. 브라우저 뒤로 가기, `navigate.pop()`, 왼쪽 가장자리 드래그 중 하나로 Home을 다시 드러낼 수 있어요."
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
              ["`Router`", "히스토리, 트랜지션, 데코레이터를 구성해요"],
              ["`Route`", "`path`(들)를 `element`에 연결해요"]
            ]
          },
          { type: "h", text: "경로 패턴" },
          {
            type: "p",
            text: "flemo는 매칭에 path-to-regexp v8을 사용해요. 배열을 넘기면 한 컴포넌트를 여러 경로에서 공유해요."
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
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterRoute {\n    "/": undefined;\n    "/posts/:slug": { slug: string };\n  }\n}'
          },
          {
            type: "code",
            lang: "tsx",
            code: 'navigate.push("/posts/:slug", { slug: "hello" }); // 통과\nnavigate.push("/posts/:slug", { id: "1" }); // 타입 에러\nnavigate.push("/unknown"); // 타입 에러'
          },
          {
            type: "note",
            text: "이 `declare module` 블록들은 서로 병합돼요. TypeScript가 코드베이스 곳곳의 `RegisterRoute` 확장을 하나의 인터페이스로 합쳐 주거든요. 그러니 레지스트리를 한 파일에 모으기보다, 각 라우트를 그 화면이 정의된 파일 맨 아래에 선언해 두는 걸 권장해요. `RegisterTransition`, `RegisterDecorator`, `RegisterPartTransition`도 마찬가지로, 트랜지션이나 데코레이터를 만든 파일에 함께 선언해 두세요."
          },
          { type: "h", text: "Router 옵션" },
          {
            type: "table",
            headers: ["Prop", "기본값", "역할"],
            rows: [
              ["`initPath`", "`/`", "`window.location` 전, SSR에서 사용하는 경로"],
              [
                "`defaultTransitionName`",
                "`cupertino`",
                "push가 트랜지션을 안 정했을 때 사용하는 값"
              ],
              ["`transitions`", "`[]`", "등록할 커스텀 트랜지션"],
              ["`decorators`", "`[]`", "등록할 커스텀 데코레이터(오버레이)"],
              ["`partTransitions`", "`[]`", "등록할 커스텀 파트 트랜지션"],
              [
                "`history`",
                "`browser`",
                "`browser`(URL + 뒤로/앞으로) 또는 `memory`(격리, URL 없음)"
              ],
              ["`name`", "없음", "다른 Router로 이동할 때 쓰는 식별자, 아래 참고"],
              ["`strictRoutes`", "`false`", "라우트 누락 개발 경고를 에러로 올려요"]
            ]
          },
          { type: "h", text: "중첩 Router와 history 모드" },
          {
            type: "p",
            text: '`Router` 안의 `Router`는 자기 스택을 가진 독립 영역이에요. 기본적으로 그 안에서도 브라우저 히스토리를 사용해서 URL이 바뀌고 브라우저 뒤로/앞으로가 동작해요. 임베드된 데모, 위저드, 캐러셀처럼 URL이나 브라우저 뒤로가기를 건드리면 안 되는 격리 스택이 필요하면 `history="memory"`를 주세요.'
          },
          { type: "h", text: "Router에 이름 주기" },
          {
            type: "p",
            text: "중첩 Router 안에서 다른 Router를 움직여야 할 때, 예를 들어 탭 영역 안의 카드가 전체 화면 상세를 열어야 할 때 `name`을 주세요. `useNavigate`가 이 이름으로 대상 Router를 찾고, 직접 적어 준 값이라 SSR과 hydration에서도 그대로예요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router name="app">\n  <Route path="/members/:id" element={<Member />} />\n  <Route path={["/region", "/region/people"]} element={<RegionActivity />} />\n</Router>;\n\nfunction RegionActivity() {\n  return (\n    <Router name="region">\n      <RegionHeader />\n      <Slot>\n        <Route path="/region" element={<RegionFeed />} />\n        <Route path="/region/people" element={<RegionPeople />} />\n      </Slot>\n    </Router>\n  );\n}'
          },
          {
            type: "p",
            text: "이름은 서로 감싸고 있는 Router들 사이에서 유일해야 해요. 같은 계층에 이름이 겹치면 어느 쪽인지 알 수 없으니 개발 환경에서 알려줘요. 서로 다른 가지에 있는 Router끼리는 이름이 같아도 괜찮아요. 이름 탐색은 호출 지점을 실제로 감싸고 있는 Router만 따라가거든요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterRouter {\n    app: true;\n    region: true;\n  }\n}'
          },
          {
            type: "p",
            text: "등록은 선택이고, `router`가 타입 검사되는 방식을 결정해요. `RegisterRouter`가 비어 있으면 아무 문자열이나 받아서 등록 없이도 `name`을 쓸 수 있어요. 이름을 등록하고 나면, 등록되지 않은 Router를 가리키는 `router`는 개발 환경 에러가 아니라 컴파일 에러가 돼요. `name` prop 자체는 그냥 문자열로 남아요. `Route`의 `path`가 `RegisterRoute`의 제약을 받지 않는 것과 같아요. 선언에는 대조할 대상이 없고, 참조에는 있으니까요."
          },
          {
            type: "note",
            text: "`name`은 내비게이션 식별자일 뿐이에요. flemo가 `history.state`를 담아 두는 키와는 별개라서, 이름을 바꿔도 히스토리 프레임이 끊기지 않아요."
          },
          { type: "h", text: "서버 사이드 렌더링" },
          {
            type: "p",
            text: "flemo는 클라이언트 SPA 라우터예요. 마운트되면 `window.history`를 직접 다루면서 내비게이션을 도맡아요. 서버엔 `window.location`이 없어서, `initPath`로 첫 화면 경로를 알려줘요. 클라이언트에선 `window.location.pathname`을 읽어 그대로 이어가요. 순수 SPA(Vite 등)에선 `initPath`가 아예 필요 없어요."
          },
          {
            type: "note",
            text: "flemo가 클라이언트 히스토리를 소유하기 때문에, 라우팅을 함께 소유하는 호스트 프레임워크와는 같이 사용할 수 없어요. 순수 SPA나, 라우팅을 호스트와 공유하지 않는 독립 클라이언트 아일랜드로 사용하세요."
          }
        ]
      },
      {
        slug: "slot",
        title: "Slot",
        blocks: [
          {
            type: "p",
            text: "기본적으로 `Router`는 화면 전체를 전환해요. 헤더, 사이드바, 하단 탭 바처럼 레이아웃의 일부가 그대로 머물러야 할 때, 화면만 `Slot`으로 감싸요. 그러면 `Slot` 바깥은 마운트된 채 가만히 있고 화면 영역만 움직여서, 내비게이션할 때마다 주변 레이아웃이 딸려 가거나 다시 렌더되지 않아요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router>\n  <Header />\n  <Slot className="h-full w-full">\n    <Route path="/" element={<Home />} />\n    <Route path="/about" element={<About />} />\n  </Slot>\n</Router>'
          },
          { type: "h", text: "크기를 주세요" },
          {
            type: "p",
            text: '`Slot`은 화면이 그 안에서 움직이는 박스예요. 일반 화면 콘텐츠를 자기 영역으로 잘라내고 화면을 absolute로 쌓기 때문에, 크기를 명시하지 않으면 높이가 0으로 줄어 아무것도 안 보일 수 있어요. `position: fixed` 오버레이는 시트나 다이얼로그가 주변 공유 바까지 덮을 수 있도록 정지 상태에서 의도적으로 이 영역을 벗어나요. 오버레이도 Slot 안에 잘려야 한다면 absolute 배치를 사용하세요. 보통 부모를 채우도록 바깥에서 `className="h-full w-full"`로 크기를 주세요.'
          },
          {
            type: "note",
            text: "`Router`에 `Route`가 아닌 자식(헤더, 효과 전용 컴포넌트)이 있으면, 라우트를 `Slot`으로 감싸 flemo가 화면과 주변 레이아웃을 구분하게 하세요."
          }
        ]
      },
      {
        slug: "screen",
        title: "Screen",
        blocks: [
          {
            type: "p",
            text: "`Screen`은 각 라우트가 그려내는 화면이에요. 상단 바, 하단 바, 세이프 에어리어 인셋 슬롯을 갖춘 컨테이너고요."
          },
          { type: "h", text: "상단 바와 하단 바" },
          {
            type: "p",
            text: "슬롯 둘, 각각 두 종류예요. 화면별 바(`topBar`, `bottomBar`)는 화면과 함께 마운트·언마운트돼요. 서로 일치하는 공유 바(`sharedTopBar`, `sharedBottomBar`)는 전환에서 빠져서 push마다 애니메이션되지 않아요. 하단 탭 바 같은 전역 UI에 공유 바를 사용해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  topBar={<TopBar title="Inbox" />}\n  sharedBottomBar={<TabBar />}\n>\n  <MailList />\n</Screen>'
          },
          {
            type: "note",
            text: "공유 바는 이전 페이지의 `Slot`과 겹쳐 보이지만 용도가 달라요. `Slot`은 모든 화면에 공통인 요소 하나를 화면 스택 바깥에 두어서, 화면이 바뀌어도 함께 움직이지 않고 늘 제자리에 있어요. 공유 바는 화면마다 각자 가지되, 서로 일치하는 바를 가진 화면끼리 오갈 땐 전환에서 빠져 제자리에 그대로 보여요. 그래서 바 안의 내용은 화면마다 달라도 돼요. 어느 화면에서나 똑같은 고정 틀이면 `Slot`을, 화면마다 내용은 달라도 끊김 없이 이어져 보여야 하는 바면 공유 바를 사용하세요."
          },
          {
            type: "p",
            text: "같은 위치의 바가 서로 다른 역할이라면 `sharedTopBarId`나 `sharedBottomBarId`로 구분하세요. 양쪽 ID가 같을 때만 제자리에서 이어지고, ID가 다르면 각자의 화면과 함께 진입·퇴장해요. 양쪽 모두 ID를 생략하면 기존의 위치 기반 동작을 유지해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  sharedBottomBar={<TabBar />}\n  sharedBottomBarId="main-tabs"\n/>\n\n<Screen\n  sharedBottomBar={<BuilderActions />}\n  sharedBottomBarId="pattern-builder-actions"\n/>'
          },
          { type: "h", text: "세이프 에어리어" },
          {
            type: "p",
            text: "`Screen`이 `statusBarHeight`·`systemNavigationBarHeight`(그리고 `*Color`·`hide*`)로 상·하단 세이프 에어리어를 직접 잡아요. 네이티브·하이브리드 WebView 앱에서 특히 중요해요. 네이티브의 세이프 에어리어 처리를 끄고 웹이 인셋을 소유하면, 전환할 때 세이프 에어리어 영역까지 화면과 함께 움직이고 색이 바뀌어요. 고정된 네이티브 바 밑으로 콘텐츠만 따로 움직여 WebView 티가 나는 어색함 없이, 화면 전체가 한 덩어리로 전환돼요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  statusBarHeight="env(safe-area-inset-top)"\n  systemNavigationBarHeight="env(safe-area-inset-bottom)"\n>\n  ...\n</Screen>'
          },
          { type: "h", text: "콘텐츠와 전환" },
          {
            type: "note",
            text: "새로 마운트되는 화면은 `children`을 프레임과 같은 커밋에 그리고, 전환은 그 콘텐츠가 그려진 첫 프레임에 시작을 앵커해요. 그래서 밀려 들어오는 건 언제나 실제 콘텐츠이고, 빈 껍데기가 먼저 보이는 일은 없어요. 첫 렌더가 정말 무거우면 그만큼 시작이 늦어질 뿐, 모션은 항상 처음부터 끝까지 온전히 재생돼요. 중간에 잘리거나 생략되지 않아요."
          },
          { type: "h", text: "전체 props" },
          {
            type: "table",
            headers: ["Prop", "타입", "기본값"],
            rows: [
              ["`topBar` / `bottomBar`", "`ReactNode`", "—"],
              ["`sharedTopBar` / `sharedBottomBar`", "`ReactNode`", "—"],
              ["`sharedTopBarId` / `sharedBottomBarId`", "`string | number`", "—"],
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
          { type: "p", text: "flemo는 이동 방식에 따라 세 가지 내비게이션 훅을 제공해요." },
          { type: "h", text: "useNavigate" },
          {
            type: "code",
            lang: "ts",
            code: 'const navigate = useNavigate();\n\nnavigate.push("/posts/:slug", { slug: "hello" });\nnavigate.replace("/login");\nnavigate.pop(); // 한 화면 뒤로\nnavigate.pop({ skip: 2 }); // 두 화면 뒤로, 전환 한 번\nnavigate.pop({ until: "/posts/:slug" }); // 가장 가까운 매칭으로'
          },
          {
            type: "p",
            text: "`push`, `replace`, `pop`은 Promise를 돌려줘서, 한 이동을 `await`한 뒤 다음 동작을 이어갈 수 있어요. 전환이 시작되고 라우트가 갱신되면 끝나요. 여러 화면을 한 번에 건너뛰어도, 화면마다가 아니라 전환은 한 번만 돌아요."
          },
          { type: "h", text: "여러 화면 한 번에 건너뛰기" },
          {
            type: "p",
            text: "셋 다 건너뛸 거리를 받아요. `skip`은 화면 수, `until`은 경로 패턴이에요. 여러 화면을 한 번의 전환으로 건너뛰어요. 건너뛴 중간 화면은 한 번도 그려지지 않고 제거돼서, 화면에 잠깐 스쳐 보이는 일이 없어요."
          },
          {
            type: "table",
            headers: ["메서드", "도착 지점에서"],
            rows: [
              ["`pop`", "그 화면에서 멈춰요. 대상은 남아요"],
              ["`replace`", "대상을 교체해요. 대상과 그 위가 새 화면이 돼요"],
              ["`push`", "대상을 두고, 그 위에 새 화면을 쌓아요"]
            ]
          },
          { type: "h", text: "옵션" },
          {
            type: "table",
            headers: ["옵션", "역할"],
            rows: [
              ["`transitionName`", "이 이동의 트랜지션을 재정의해요(`pop`에선 뒤로 애니메이션)"],
              [
                "`layoutId`",
                "이 엔트리가 어느 항목에서 열렸는지 표시, `useScreen().layoutId`로 읽어요"
              ],
              ["`skip` / `until`", "한 번의 전환으로 여러 화면 건너뛰기"],
              ["`router`", "이 내비게이션을 실행할 Router 지정, 아래 참고"]
            ]
          },
          { type: "h", text: "어느 Router가 움직일지 정하기" },
          {
            type: "p",
            text: "Router가 중첩돼 있으면 `useNavigate`는 가장 가까운 Router를 움직여요. `Slot` 안에서 화면을 바꿀 땐 그게 맞지만, 전체 화면으로 덮어야 하는 이동에선 바깥 레이아웃이 그대로 남고 안쪽 영역만 전환되는 어색한 결과가 나와요. 대상 Router를 지정하면 처음부터 그 Router의 히스토리, 트랜지션, 제스처로 이동해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '// 중첩된 "region" Router 안에서.\nconst navigate = useNavigate();\n\n// region Slot 안에서만 전환돼요.\nnavigate.push("/region/people");\n\n// app Router에서 전체 화면으로 전환돼요.\nnavigate.push("/members/:id", { id }, { router: "app" });'
          },
          {
            type: "p",
            text: "훅 단위로 대상을 한 번만 정해 둘 수도 있어요. 호출 단위 `router`가 훅 기본값보다 우선하고, 둘 다 훅을 호출한 위치를 기준으로 해석돼요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'const regionNavigate = useNavigate();\nconst appNavigate = useNavigate({ router: "app" });\nconst parentNavigate = useNavigate({ router: "parent" });\n\nappNavigate.push("/members/:id", { id });\nregionNavigate.replace("/region/people", undefined, { transitionName: "tabForward" });\nparentNavigate.pop({ transitionName: "cupertino" });'
          },
          {
            type: "table",
            headers: ["대상", "선택되는 Router"],
            rows: [
              ["생략 / `current`", "가장 가까운 Router(기본값)"],
              ["`parent`", "한 단계 바깥 Router"],
              ["`root`", "현재 계층의 최상위 Router"],
              ['`"app"`(이름)', '`name="app"`으로 선언한, 감싸고 있는 Router'],
              ["`nearest-owner`", "바깥으로 올라가며 그 경로를 선언한 첫 Router"]
            ]
          },
          {
            type: "p",
            text: '문자열은 예약어로 먼저 읽고, 예약어가 아니면 Router 이름으로 읽어요. Router 이름이 예약어와 겹친다면 객체 형태로 분명히 할 수 있어요. `{ router: { name: "parent" } }`는 `parent`라는 이름의 Router를, `{ router: { scope: "parent" } }`는 한 단계 바깥 Router를 가리켜요.'
          },
          { type: "h", text: "그 Router에 라우트가 없을 때" },
          {
            type: "p",
            text: "`RegisterRoute`는 전역 레지스트리 하나예요. 그래서 타입은 통과하지만 정작 이동하려는 Router에는 그 라우트가 없을 수 있어요. 그러면 그 히스토리 엔트리에 마운트할 `Route`가 없어서 영역이 빈 화면으로 전환돼요. 중첩 Router에게 전체 화면 경로를 시켰을 때 보이던 깨진 전환이 바로 이거예요."
          },
          {
            type: "list",
            items: [
              "지정한 Router가 그 경로를 선언하지 않음: 개발 환경 에러",
              "지정한 Router가 계층에 없거나, 최상위에서 `parent`를 요청: 개발 환경 에러",
              "대상을 생략했는데 가장 가까운 Router가 그 경로를 선언하지 않음: 개발 환경 경고, 동작은 그대로",
              '마지막 경우도 에러로 올리려면 `Router`에 `strictRoutes`를 주거나, `router: "nearest-owner"`로 경로를 가진 Router를 flemo가 고르게 하세요'
            ]
          },
          {
            type: "note",
            text: "모두 개발 환경에서만 동작해요. 프로덕션에서는 내비게이션 때문에 예외를 던지지 않으니, 놓친 실수가 있어도 이전과 똑같이 동작해요."
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
            text: "`useStep()`은 화면을 바꾸지 않고, 한 화면 안에서 단계만 앞뒤로 넘기는 훅이에요. 회원가입 폼의 이름 → 이메일 → 비밀번호처럼요. 라우트도 `Screen`도 그대로고 파라미터만 바뀌지만, 히스토리에는 쌓여서 뒤로가기로 이전 단계로 돌아와요."
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
              ["`layout`", "공유 요소가 이동할 자리를 남기는 옅은 페이드"],
              ["`none`", "즉시 컷, 애니메이션 없음"]
            ]
          },
          {
            type: "p",
            text: "`Router`에 전역 기본값을 두거나, 이동마다 `transitionName`으로 재정의해요."
          },
          { type: "h", text: "중첩" },
          {
            type: "p",
            text: "모핑은 중첩되고, 안쪽 모핑은 바깥 모핑에 **실려서** 갑니다. 카드를 `<Morph>`로 두고 그 안의 아트워크도 `<Morph>`로 두면, 이동하는 건 카드이고 아트워크는 카드 위 제자리를 지킨 채 함께 갑니다. 의도된 선택이에요. 둘을 각자의 곡선으로 날리면 비행 도중에 카드가 분해돼서, 아트워크가 자기가 들어 있어야 할 상자 밖으로 흘러나갑니다. 눈이 따라가는 단위는 컨테이너예요."
          },
          {
            type: "note",
            text: '모핑은 transform이라, 14px에서 24px로 커지는 제목은 글자를 다시 조판하는 게 아니라 확대돼요. 텍스트에는 빌트인 `text` 프리셋(`<Morph name="text">`)을 쓰세요. 줄 상자(line box) 기준으로 키우고 시작 모서리를 고정해요. 가로폭 기준이 함정인데, 텍스트 블록의 폭은 담고 있는 컨테이너의 폭이라 글자 크기와 무관해서 목표보다 부풀었다가 다시 줄어드는 것처럼 보여요.'
          },
          { type: "h", text: "요소가 곧 화면이 될 때" },
          {
            type: "p",
            text: '뷰포트를 가득 채우는 컨테이너도 상자가 커진 같은 기능이에요. 그 뒤에서 무슨 일이 일어나는지는 모핑이 아니라 **화면 트랜지션**의 소관이고요. 물러나는 화면이 축소되며 흐려지도록 작성하고(`exit: { scale: 0.92, filter: "blur(10px)" }`), 도착 화면은 투명하게 두어 그게 비치게 하면, 요소가 물러나는 배경 위로 열립니다. 둘의 박자는 저절로 맞아요. 길이를 안 정한 모핑은 비행 중인 화면의 길이를 물려받고, 하나의 홀드가 둘을 같은 프레임에 놓아줍니다.'
          },
          { type: "h", text: "직접 만들기" },
          {
            type: "p",
            text: "`createTransition`은 여섯 단계를 정의해요."
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
            text: "각 단계의 `options`가 타이밍을 정해요. `duration`과 `delay`는 초 단위이고, `ease`는 키워드(`linear`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `backIn`, `backOut`, `anticipate`) 또는 `[0.32, 0.72, 0, 1]` 같은 4-숫자 cubic-bezier 배열을 받아요."
          },
          {
            type: "p",
            text: "`RegisterTransition`을 확장하면 `transitionName` 자동완성이 돼요(`RegisterRoute`와 같은 모듈 확장이에요). 그다음 `Router`에 등록해요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterTransition {\n    myFade: "myFade";\n  }\n}'
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Router transitions={[myFade]} defaultTransitionName="myFade">\n  ...\n</Router>'
          },
          { type: "h", text: "무엇을 애니메이션할 수 있나요" },
          {
            type: "p",
            text: "트랜지션 타깃은 `transform`과 `opacity`에 국한되지 않아요. 애니메이션 가능한 CSS 속성이면 뭐든 받아요. `clipPath`, `filter`, `borderRadius`, `boxShadow`, `color`, 커스텀 프로퍼티까지 CSS 전 영역을 TypeScript 자동완성과 함께 쓸 수 있어요. 여기에 transform 단축키 `x`, `y`, `z`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY`, `rotateZ`가 더해져서, 전체 `translateX` 대신 `{ x: 16 }`처럼 쓸 수 있어요. 숫자만 쓰면 알맞은 단위가 붙어요. 길이엔 `px`, 회전엔 `deg`, CSS가 단위 없는 값엔 단위 없이요."
          },
          {
            type: "p",
            text: "한 값의 두 끝점이 같은 형태일 필요는 없어요. `clip-path`가 서로 다른 템플릿 사이를 모핑하거나(`inset(0 0 0 100%)`에서 `inset(0)`으로), 값이 `calc()` 식이거나(`calc(100% - 20px)`), 두 끝점이 단위를 섞어도(`50%`에서 `200px`으로) 돼요. 각 값을 어떻게 굴릴지 가장 좋은 경로는 라이브러리가 알아서 골라요. 따로 설정할 모드는 없어요."
          },
          {
            type: "p",
            text: "한쪽 끝에서 속성을 빼도 돼요. `transform` 채널과 `opacity`는 중립값(원형 그대로, 완전 불투명)으로 되돌아가고, 그 밖의 속성은 요소의 현재 화면 값에서 시작해요."
          },
          {
            type: "note",
            text: "값은 브라우저 자체의 CSS 보간으로 움직여요. 그래서 CSS가 불연속으로만 바꿀 수 있는 쌍은 트위닝 대신 중간 지점에서 툭 바뀌어요. 네이티브 CSS와 똑같이요. `clip-path`는 두 `inset()` 값 사이는 트위닝하지만, 도형 함수 자체가 바뀌면(`inset()`에서 `circle()`으로) 건너뛰어요. 두 끝점을 같은 종류의 유효한 CSS로 유지하세요."
          },
          {
            type: "p",
            text: "다음 `wipe` 트랜지션이 이걸 실제로 보여줘요. 프리셋이 아니라 직접 만드는 커스텀 트랜지션이에요. 들어오는 화면이 왼쪽에서 오른쪽으로 열리는 `clip-path`로 드러나고, 그 아래 화면은 살짝 축소되고 흐려지며 물러나요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createTransition } from "@flemo/react";\n\nconst EASE = [0.65, 0, 0.35, 1] as const;\n\nconst wipe = createTransition({\n  name: "wipe",\n  initial: { clipPath: "inset(0 0 0 100%)" },\n  idle: { value: { clipPath: "inset(0)", scale: 1, opacity: 1 }, options: { duration: 0 } },\n  enter: { value: { clipPath: "inset(0)" }, options: { duration: 0.45, ease: EASE } },\n  enterBack: { value: { clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.38, ease: EASE } },\n  exit: { value: { scale: 0.96, opacity: 0.8 }, options: { duration: 0.45, ease: EASE } },\n  exitBack: { value: { scale: 1, opacity: 1 }, options: { duration: 0.38, ease: EASE } }\n});'
          },
          {
            type: "p",
            text: "두 `clip-path` 끝점은 일부러 다른 템플릿을 써요. 네 값짜리 `inset(0 0 0 100%)`과 `inset(0)` 단축형인데도 매끄럽게 트위닝돼요."
          },
          { type: "h", text: "Raw 트랜지션" },
          {
            type: "p",
            text: "`createTransition`은 push·replace·pop을 하나의 대칭 phase 세트에서 끌어내요. 그게 너무 뭉뚱그려질 때 `createRawTransition`이 저수준 탈출구예요. 들어오는 화면과 나가는 화면을 작업(push·replace·pop)마다 직접 다 적어서, push가 replace나 pop과 다르게 움직이게 할 수 있어요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createRawTransition } from "@flemo/react";\n\nexport const shove = createRawTransition({\n  name: "shove",\n  initial: { transform: "translateX(100%)" },\n  idle: { value: { transform: "translateX(0)" }, options: { duration: 0 } },\n  pushOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0.4 } },\n  pushOnExit: { value: { transform: "translateX(-30%)" }, options: { duration: 0.4 } },\n  replaceOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0.4 } },\n  replaceOnExit: { value: { transform: "translateX(-100%)" }, options: { duration: 0.4 } },\n  popOnEnter: { value: { transform: "translateX(-30%)" }, options: { duration: 0.4 } },\n  popOnExit: { value: { transform: "translateX(100%)" }, options: { duration: 0.4 } },\n  completedOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0 } },\n  completedOnExit: { value: { transform: "translateX(0)" }, options: { duration: 0 } }\n});'
          },
          { type: "h", text: "스와이프" },
          {
            type: "p",
            text: '프리셋이든 커스텀이든, `options`에 `swipeDirection`(`"x"` 또는 `"y"`)과 핸들러 세 개를 주면 제스처로 끌 수 있어요. 드래그하는 동안엔 핸들러가 화면을 맡아요. flemo가 포인터 데이터와 두 화면 요소를 넘겨주면, 핸들러가 화면을 움직이고 진행도를 보고하고 결과를 정해요. 내장 cupertino 엣지 스와이프 뒤로가기가 바로 이 방식이에요.'
          },
          {
            type: "table",
            headers: ["훅", "시그니처", "역할"],
            rows: [
              [
                "`onSwipeStart`",
                "`(event, info, { animate, currentScreen, prevScreen, onStart })`",
                "제스처를 받아들일지 정해요. `true`를 반환하면 스와이프를 시작하고, `false`면 드래그를 무시해요"
              ],
              [
                "`onSwipe`",
                "`(event, info, { animate, currentScreen, prevScreen, onProgress })`",
                "드래그하는 매 프레임 실행돼요. 두 화면을 움직이고, 0에서 100까지의 진행도를 계산해 `onProgress`로 보고한 뒤 그 값을 반환해요"
              ],
              [
                "`onSwipeEnd`",
                "`(event, info, { animate, currentScreen, prevScreen, onStart })`",
                "`info.offset`과 `info.velocity`로 커밋 여부를 정하고, `onStart`로 판정을 전달하고, 두 화면을 안착시킨 뒤 판정을 반환해요"
              ]
            ]
          },
          {
            type: "list",
            items: [
              "`info`는 `{ point, offset, velocity, delta }`이고, 각각 `{ x, y }` 쌍이에요",
              "`animate(element, target, options?)`는 화면에 값을 써요. `{ duration: 0 }`을 주면 손가락을 따라가고, 짧은 duration과 `ease`를 주면 안착해요",
              "`onProgress`로 보고하는 `progress`가 트랜지션의 데코레이터와 양쪽 화면의 모든 `Part`를 움직여요. 그래서 제스처 하나가 장면 전체를 끌어요(Part 페이지 참고)",
              "`onSwipeEnd`에서 `true`를 반환하면 스와이프가 이미 pop 애니메이션을 재생한 셈이라, flemo가 그걸 다시 재생하지 않고 뒤로가기를 완료해요. `false`를 반환하면 전부 원래 자리로 돌아가요"
            ]
          },
          {
            type: "p",
            text: "이게 cupertino의 실제 `options` 블록이에요. `linear` 헬퍼가 드래그 오프셋을 0에서 100까지의 진행도로 매핑하고, 핸들러 세 개가 나머지를 맡아요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'const linear = (value: number, from: [number, number], to: [number, number]) => {\n  const [fromMin, fromMax] = from;\n  const [toMin, toMax] = to;\n  if (fromMax === fromMin) return toMin;\n  const t = (value - fromMin) / (fromMax - fromMin);\n  return toMin + t * (toMax - toMin);\n};\n\nconst cupertino = createTransition({\n  name: "cupertino",\n  // ...phases\n  options: {\n    decoratorName: "overlay",\n    swipeDirection: "x",\n    onSwipeStart: async () => {\n      return true;\n    },\n    onSwipe: (_, info, { animate, currentScreen, prevScreen, onProgress }) => {\n      const { offset } = info;\n      const dragX = offset.x;\n      const progress = linear(dragX, [0, window.innerWidth], [0, 100]);\n\n      onProgress?.(true, progress);\n\n      animate(currentScreen, { x: Math.max(0, dragX) }, { duration: 0 });\n      animate(prevScreen, { x: `${-35 + progress * 0.35}%` }, { duration: 0 });\n\n      return progress;\n    },\n    onSwipeEnd: async (_, info, { animate, currentScreen, prevScreen, onStart }) => {\n      const { offset, velocity } = info;\n      const dragX = offset.x;\n      const isTriggered = dragX > 50 || velocity.x > 20;\n\n      onStart?.(isTriggered);\n\n      await Promise.all([\n        animate(currentScreen, { x: isTriggered ? "100%" : 0 }, { duration: 0.3, ease: [0.32, 0.72, 0, 1] }),\n        animate(prevScreen, { x: isTriggered ? 0 : "-35%" }, { duration: 0.3, ease: [0.32, 0.72, 0, 1] })\n      ]);\n\n      return isTriggered;\n    }\n  }\n});'
          },
          { type: "h", text: "데코레이터" },
          {
            type: "p",
            text: "데코레이터는 이전 화면과 현재 화면 사이에 놓여요. 내장 `overlay`가 cupertino 스와이프 중의 딤이에요. `createDecorator`로 만들고, 트랜지션에 `decoratorName`으로 붙이고, `Router`에 등록해요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createDecorator } from "@flemo/react";\n\nconst dim = createDecorator({\n  name: "dim",\n  initial: { opacity: 0 },\n  idle: { value: { opacity: 0 }, options: { duration: 0 } },\n  enter: { value: { opacity: 0.4 }, options: { duration: 0.3 } },\n  exit: { value: { opacity: 0 }, options: { duration: 0.3 } }\n});'
          },
          {
            type: "p",
            text: "타입이 잡히도록 `RegisterDecorator`를 확장해요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterDecorator {\n    dim: "dim";\n  }\n}'
          },
          {
            type: "p",
            text: "트랜지션에 `decoratorName`으로 데코레이터를 연결하고, 데코레이터와 트랜지션을 `Router`에 함께 등록해요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'const dive = createTransition({\n  name: "dive",\n  // ...phases\n  options: { decoratorName: "dim" }\n});'
          },
          {
            type: "code",
            lang: "tsx",
            code: "<Router transitions={[dive]} decorators={[dim]}>\n  ...\n</Router>"
          }
        ]
      },
      {
        slug: "part",
        title: "Part",
        blocks: [
          {
            type: "p",
            text: "`Part`는 화면 안의 한 요소에 자기만의 애니메이션을 줘요. 화면 생명주기로 구동되고 화면 전환에 맞춰 함께 동작하되, 화면 전체가 아니라 감싼 그 요소만 움직여요. 대표적인 예는 고정된 공유 바에서 타이틀만 화면을 오갈 때 떠오르며 흐려지고, 나머지 바는 제자리에 그대로 있는 거예요."
          },
          {
            type: "p",
            text: "`Part`는 자식을 감싸는 `<div>`를 그려요. 고유 prop은 실행할 파트 트랜지션 이름인 `name` 하나뿐이고, 나머지는 전부 일반 `div` prop(`className`, `style`, `ref`, children)이라 여느 요소처럼 스타일과 위치를 줄 수 있어요. 움직이는 건 감싼 요소뿐이에요. 바나 화면의 나머지는 제자리에 그대로 있어요."
          },
          { type: "h", text: "파트 트랜지션 만들기" },
          {
            type: "p",
            text: "`createPartTransition`으로 트랜지션을 만들고, `RegisterPartTransition`을 확장해 `name`을 타입 안전하게 해요(`RegisterRoute`와 같은 모듈 확장이에요). 파트는 화면 생명주기를 세 가지 정지 상태로 줄여요."
          },
          {
            type: "table",
            headers: ["상태", "적용 시점"],
            rows: [
              ["`initial`", "애니메이션 전 요소의 스타일"],
              ["`idle`", "화면이 활성 상태로 정지해 있거나, 새 맨 위 화면으로 들어올 때"],
              ["`enter`", "push·replace로 화면이 뒤 배경으로 물러나 그대로 머무를 때"],
              ["`exit`", "pop으로 뒤에 있던 화면이 다시 활성으로 돌아올 때"]
            ]
          },
          {
            type: "p",
            text: "`createTransition`이 상태를 다섯 개(`idle`, `enter`, `enterBack`, `exit`, `exitBack`) 늘어놓는다면, 파트는 세 개로 줄여요. 프로그래밍 방식 push·replace·pop에서는 파트가 화면 전환에 맞춰 자동으로 함께 움직여요. 그 경로엔 프레임 단위 코드가 전혀 필요 없어요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createPartTransition } from "@flemo/react";\n\nconst EASE = [0.32, 0.72, 0, 1] as const;\n\nconst panelTitle = createPartTransition({\n  name: "panel-title",\n  initial: { opacity: 1, y: 0 },\n  idle: { value: { opacity: 1, y: 0 }, options: { duration: 0 } },\n  enter: { value: { opacity: 0.35, y: -10 }, options: { duration: 0.6, ease: EASE } },\n  exit: { value: { opacity: 1, y: 0 }, options: { duration: 0.6, ease: EASE } }\n});'
          },
          {
            type: "code",
            lang: "ts",
            code: 'declare module "@flemo/react" {\n  interface RegisterPartTransition {\n    "panel-title": "panel-title";\n  }\n}'
          },
          {
            type: "p",
            text: "`transitions`·`decorators`와 똑같이 `Router`에 등록해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: "<Router partTransitions={[panelTitle]}>\n  ...\n</Router>"
          },
          {
            type: "p",
            text: "그다음 요소를 `Part`로 감싸요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Part, Screen } from "@flemo/react";\n\nfunction Panel() {\n  return (\n    <Screen sharedTopBar={<header><Part name="panel-title">Inbox</Part></header>}>\n      <MailList />\n    </Screen>\n  );\n}'
          },
          { type: "h", text: "스와이프 따라가기" },
          {
            type: "p",
            text: "여기까지가 정지 애니메이션이고, 프로그래밍 방식 push·pop엔 이것만으로 충분해요. 인터랙티브 스와이프(cupertino의 엣지 스와이프 뒤로 같은) 중에는, 스와이프 훅이 없는 파트도 스와이프가 커밋되면 제자리에 잘 안착하지만 손가락을 따라가지 않고 끝에서만 정리돼요. 드래그를 따라가게 하려면 `options`에 스와이프 훅을 더하세요."
          },
          {
            type: "p",
            text: "파트도 같은 훅 세 개(`onSwipeStart`, `onSwipe`, `onSwipeEnd`)를 요소 단위 형태로 받아요. 각각 `(triggered, { animate, element, active })`를 받고, `onSwipe`엔 0에서 100까지의 드래그 `progress`가 더 붙어요. 화면 트랜지션이 보고하는 바로 그 진행도예요(Transitions 페이지 참고). 여기엔 포인터 이벤트도 화면도 없어요. 감싼 `element`와, 거기에 값을 쓰는 `animate`, 그리고 그 요소가 현재 맨 위 화면에 있는지(`true`) 드러나는 이전 화면에 있는지(`false`)를 알려주는 `active`뿐이에요. 리듬은 화면 훅과 같아요. `onSwipe`에선 `{ duration: 0 }`으로 손가락을 따라가고, `onSwipeEnd`에선 짧게 안착하며 `triggered`가 스와이프 커밋 여부를 알려줘요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'const panelTitle = createPartTransition({\n  name: "panel-title",\n  initial: { opacity: 1, y: 0 },\n  idle: { value: { opacity: 1, y: 0 }, options: { duration: 0 } },\n  enter: { value: { opacity: 0.35, y: -10 }, options: { duration: 0.6, ease: EASE } },\n  exit: { value: { opacity: 1, y: 0 }, options: { duration: 0.6, ease: EASE } },\n  options: {\n    onSwipe: (_, progress, { animate, element, active }) => {\n      if (active) return;\n      const recovered = Math.min(1, Math.max(0, progress / 100));\n      animate(\n        element,\n        { opacity: 0.35 + 0.65 * recovered, y: -10 * (1 - recovered) },\n        { duration: 0 }\n      );\n    },\n    onSwipeEnd: (triggered, { animate, element, active }) => {\n      if (active) return;\n      animate(element, triggered ? { opacity: 1, y: 0 } : { opacity: 0.35, y: -10 }, {\n        duration: 0.3,\n        ease: EASE\n      });\n    }\n  }\n});'
          },
          {
            type: "p",
            text: "각 훅 맨 위의 `if (active) return;`이 핵심이에요. 스와이프 뒤로 중에는 맨 위 화면이 나가고 이전 화면이 돌아오므로, 드래그에 맞춰 회복해야 하는 건 이전 화면의 파트뿐이에요. 활성 쪽은 자기 화면을 따라 움직이면 그만이라 훅에서 일찍 빠져나와요. `onSwipe`는 드래그 `progress`를 타이틀의 opacity와 위치에 매 프레임 매핑하고, `onSwipeEnd`는 스와이프가 커밋됐는지에 따라 나머지를 안착시켜요."
          },
          {
            type: "note",
            text: "작업별로 더 세밀히 제어하려면 `createRawPartTransition`이 `createRawTransition`처럼 모든 status를 열어줘요: `idle`, `pushOnEnter`·`pushOnExit`, `replaceOnEnter`·`replaceOnExit`, `popOnEnter`·`popOnExit`, `completedOnEnter`·`completedOnExit`요."
          }
        ]
      },
      {
        slug: "layer",
        title: "Layer",
        blocks: [
          {
            type: "p",
            text: "`Layer`는 오버레이를 화면 안이 아니라 화면 옆에 그려요. 그래서 오버레이가 공유 바를 덮을 수 있고, 화면이 아래에서 움직여도 살아남아요. 탭바까지 어둡게 덮어야 하는 바텀시트가 대표적인 쓰임새예요."
          },
          { type: "h", text: "왜 화면 안에서는 안 될까요" },
          {
            type: "p",
            text: '움직이는 화면은 transform을 갖고, transform은 `position: fixed` 자손의 기준 상자이자 내부 전체를 감싸는 쌓임 맥락이 돼요. 공유 바는 화면 바깥의 형제라서, 화면 안에서 쓴 오버레이는 바 입장에서 화면 콘텐츠와 한 덩어리예요. "콘텐츠는 바 아래, 시트는 바 위"는 그 안에서는 어떤 z-index로도 표현할 수 없어요. `Layer`는 오버레이를 화면 옆의 호스트로 포털해요. 트릭의 전부는 그리는 순서만 화면을 떠난다는 것이에요.'
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Layer, Screen } from "@flemo/react";\n\nfunction Inbox() {\n  const [open, setOpen] = useState(false);\n\n  return (\n    <Screen sharedBottomBar={<TabBar />}>\n      <MailList onCompose={() => setOpen(true)} />\n      <Layer>\n        <ComposeSheet open={open} onClose={() => setOpen(false)} />\n      </Layer>\n    </Screen>\n  );\n}'
          },
          {
            type: "p",
            text: "오버레이는 여전히 자기 화면 소속이에요. 화면의 스택 위치와 status, 전환을 그대로 따라가니까 내비게이션 중에는 화면과 함께 움직이고 pop에서는 함께 떠나요. React도 화면과 함께 얼리고 화면과 함께 언마운트해요. 자식의 포지셔닝은 그대로 유지되니 `position: fixed; bottom: 0`으로 쓴 시트가 그대로 동작해요."
          },
          { type: "h", text: "필요 없는 경우" },
          {
            type: "p",
            text: "멈춰 있는 화면에는 transform이 없어요. 그래서 평범한 `position: fixed` 오버레이는 이미 뷰포트를 기준으로 놓이고, z-index만으로 바 위에 올라갈 수 있어요. `Layer`는 화면이 움직이는 동안 살아남아야 하는 오버레이, 그리고 조상 화면이 선언한 크롬을 넘어야 하는 오버레이를 위한 것이에요."
          },
          {
            type: "note",
            text: "`Layer`는 서버에서, 그리고 호스트가 마운트되기 전 첫 클라이언트 렌더에서는 아무것도 그리지 않아요. 호스트는 가장 바깥 화면의 것이라 루트 `Router`의 뷰포트 크기 영역을 기준으로 놓여요. 중첩 `Router` 안에서 쓰면 오버레이의 `bottom: 0`은 중첩된 상자가 아니라 그 바깥 영역에 맞춰져요."
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
              ["`Screen`", "상단/하단 바와 세이프 에어리어 슬롯을 가진 화면", "`@flemo/react`"],
              ["`Slot`", "전환 영역 표시, 주변 레이아웃은 유지", "`@flemo/react`"],
              ["`Part`", "화면 안 한 요소에 이름 붙인 파트 트랜지션을 실행", "`@flemo/react`"],
              ["`Morph`", "공유 요소, `layoutId`로 짝지은 두 화면의 한 물건", "`@flemo/react`"]
            ]
          },
          { type: "h", text: "훅" },
          {
            type: "table",
            headers: ["Export", "반환"],
            rows: [
              ["`useNavigate(options?)`", "`{ push, replace, pop }`, 대상 Router 지정 가능"],
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
              ["`isActive`", "지금 활성(맨 위) 화면인지"],
              ["`isRoot`", "자기 스택의 루트(첫) 화면인지"],
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
              "`createTransition` / `createRawTransition` 트랜지션 제작",
              "`createDecorator` / `createRawDecorator` 데코레이터 제작",
              "`createPartTransition` / `createRawPartTransition` 파트 트랜지션 제작",
              "내장 트랜지션: `cupertino`, `material`, `layout`, `none`",
              "내장 데코레이터: `overlay`"
            ]
          },
          { type: "h", text: "타입 레지스트리" },
          {
            type: "table",
            headers: ["인터페이스", "용도"],
            rows: [
              ["`RegisterRoute`", "타입 안전한 `push`·`useParams`를 위한 라우트 등록"],
              ["`RegisterRouter`", "타입 안전한 `router` 대상 지정을 위한 Router 이름 등록"],
              ["`RegisterTransition`", "커스텀 트랜지션 이름 등록"],
              ["`RegisterDecorator`", "커스텀 데코레이터 이름 등록"],
              ["`RegisterPartTransition`", "커스텀 파트 트랜지션 이름 등록"]
            ]
          },
          { type: "h", text: "Peer 의존성" },
          {
            type: "p",
            text: "`@flemo/react`는 `react ^19`, `react-dom ^19`만 필요해요. 공유 요소 모핑까지 포함해서 그게 전부예요. 예전에는 `@flemo/react-layout`과 `motion`이 필요했지만, 이제 같은 패키지의 `<Morph>`예요."
          }
        ]
      }
    ]
  },
  {
    title: "공유 요소",
    pages: [
      {
        slug: "morph",
        title: "Morph",
        blocks: [
          {
            type: "p",
            text: "`<Morph>`는 두 화면에 걸쳐 존재하는 요소를 표시해요. 양쪽에 같은 `layoutId`를 주면 flemo가 하나의 물건으로 다뤄요. 도착 요소가 짝이 있던 자리에서 출발하고, 아직 서로 겹쳐 있는 동안 자리를 바꾸고, 자기 레이아웃이 정한 위치에 정확히 착지해요."
          },
          {
            type: "note",
            text: "모핑에는 전용 화면도, 특정 트랜지션도 필요 없어요. 고른 트랜지션을 그대로 쓰세요. 비행하는 동안 요소는 두 화면 **위**에 올라가 있어서, 화면이 페이드하든 슬라이드하든 컷하든 요소를 자르거나 덮거나 끌고 갈 수 없어요."
          },
          { type: "h", text: "출발 화면" },
          {
            type: "p",
            text: "이동할 요소를 감싸요. 짝짓기는 `layoutId` 하나로 끝나요. 기억할 push 옵션도, 갈아끼울 `Screen`도 없어요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Morph, Screen, useNavigate } from "@flemo/react";\n\nfunction Gallery() {\n  const { push } = useNavigate();\n\n  return (\n    <Screen>\n      <ul>\n        {photos.map((photo) => (\n          <li key={photo.id}>\n            <Morph\n              layoutId={`photo-${photo.id}`}\n              onClick={() => push("/photos/:id", { id: photo.id })}\n            >\n              <img src={photo.thumb} alt="" />\n            </Morph>\n          </li>\n        ))}\n      </ul>\n    </Screen>\n  );\n}'
          },
          { type: "h", text: "도착 화면" },
          {
            type: "p",
            text: "같은 `layoutId`를, 그 요소가 도착 화면에서 있어야 할 자리에 두면 돼요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Morph, Screen, useParams } from "@flemo/react";\n\nfunction Photo() {\n  const { id } = useParams<{ id: string }>();\n\n  return (\n    <Screen>\n      <Morph layoutId={`photo-${id}`} className="hero">\n        <img src={photoById(id).full} alt="" />\n      </Morph>\n    </Screen>\n  );\n}'
          },
          { type: "h", text: "무슨 일이 일어나나요" },
          {
            type: "list",
            items: [
              "이동이 시작되는 순간 출발 요소의 박스를 재요. 사용자가 마지막으로 본 그 자리예요",
              "비행 동안 요소는 자기 화면을 떠났다가 착지할 때 돌아와요. 스크롤 컨테이너도, 불투명한 도착 화면도, 미끄러지는 트랜지션도 이동을 방해할 수 없어요",
              "실제 레이아웃 박스에 착지하므로, 정지 프레임은 구조적으로 픽셀 단위까지 정확해요",
              "모서리 반경도 함께 옮겨가요. 스케일로 미리 나눠 두어서 양 끝에서 작성한 크기 그대로 보여요"
            ]
          },
          {
            type: "note",
            text: "이동이 시작될 때 양쪽이 모두 마운트돼 있어야 해요. 모핑은 라우트가 아니라 요소를 짝지어요. 그리고 비행 동안 요소는 여러분의 트리 밖으로 잠깐 옮겨졌다가 원래대로 돌아오니, 이동 중에 바깥에서 그 요소를 재거나 건드리지 마세요."
          },
          { type: "h", text: "직접 만들기" },
          {
            type: "p",
            text: "모핑도 flemo의 다른 트랜지션과 똑같은 1급 프리미티브예요. `createMorphTransition`은 `createTransition`과 같은 모양(`initial` + enter/exit 두 면)이고, `Router`에 등록한 뒤 이름으로 참조해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { createMorphTransition, Morph, Router } from "@flemo/react";\n\nconst unfold = createMorphTransition({\n  name: "unfold",\n  initial: { opacity: 0 },\n  idle: { value: { opacity: 1 }, options: { duration: 0 } },\n  enter: { value: { opacity: 1 }, options: { duration: 0.45, ease: [0.32, 0.72, 0, 1] } },\n  exit: { value: { opacity: 0 }, options: { duration: 0.45 } },\n  options: { crossFade: 0.25 }\n});\n\n<Router morphTransitions={[unfold]}>...</Router>;\n\n<Morph layoutId={`photo-${id}`} name="unfold" />;'
          },
          {
            type: "p",
            text: "이동 자체는 작성하는 게 아니라 비행마다 측정돼요. 작성하는 건 그 밖의 전부예요. 타이밍, 페이드, 그리고 이동 위에 합성되는 선택적인 transform 장식이요."
          },
          {
            type: "table",
            headers: ["옵션", "역할"],
            rows: [
              ["`crossFade`", "두 면이 넘겨받는 구간, 전체 길이 대비 비율(0-1, 기본 0.12)"],
              [
                "`scale`",
                "`box`는 축별로 짝에 맞추고, `width`/`height`는 한 비율로만 키워 왜곡이 없으며, `none`은 이동만"
              ],
              ["`anchor`", "두 상자가 겹칠 기준점. `centre`, 좌측 정렬 콘텐츠라면 `start`"],
              ["`radius`", "스케일 보정된 양 끝값으로 `border-radius` 보간(기본 true)"],
              ["`enter` / `exit`", "도착 요소와 그것이 대체하는 요소, 동시에 움직여요"],
              ["`options.duration`", "비우면 비행 중인 화면의 길이를 물려받아 화면과 함께 착지해요"]
            ]
          },
          {
            type: "note",
            text: "빌트인 `shared` 프리셋은 일부러 길이를 안 정해요. 그래서 어떤 트랜지션과 짝지어도 하나의 모핑이 알맞게 보여요."
          },
          { type: "h", text: "@flemo/react-layout에서 옮겨오기" },
          {
            type: "p",
            text: '`@flemo/react-layout`과 `motion` peer 의존성은 사라졌어요. `LayoutScreen`은 그냥 `Screen`이고(이동 중인 요소를 실은 화면이 짝을 덮지 않도록 flemo가 알아서 처리해요), `LayoutConfig`는 타이밍이 이미 flemo 것이라 할 일이 없어요. `motion.div layoutId="x"`는 각각 `<Morph layoutId="x">`가 돼요.'
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

export function getDocSection(lang: string, slug: string): DocSection | undefined {
  return getDocSections(lang).find((section) => section.pages.some((page) => page.slug === slug));
}

// The first paragraph, trimmed to a meta-description length. Powers per-page SEO
// (each doc gets its own <meta name="description">), so search results describe
// the actual page instead of repeating the site tagline.
export function getDocPageDescription(lang: string, slug: string): string | undefined {
  const paragraph = getDocPage(lang, slug)?.blocks.find((block) => block.type === "p");
  if (!paragraph || !("text" in paragraph)) return undefined;
  return paragraph.text.length > 155 ? `${paragraph.text.slice(0, 152)}...` : paragraph.text;
}
