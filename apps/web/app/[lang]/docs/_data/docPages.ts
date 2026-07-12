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
          { type: "p", text: "flemo is a router for screen transitions." },
          {
            type: "p",
            text: "Native apps move by pushing a screen on, popping it off, and swiping back to leave. flemo lets you build that same flow on the web."
          },
          {
            type: "p",
            text: "The transitions between screens can use the built-in presets, or ones you define yourself."
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
          { type: "h", text: "Install" },
          { type: "code", lang: "bash", code: "pnpm add @flemo/react" },
          {
            type: "note",
            text: "Svelte and SolidJS support is planned."
          },
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
            text: 'The `Slot` is the box your screens animate inside. It clips to its own bounds and stacks the screens with absolute positioning, so without an explicit size it can collapse to zero height and show nothing. Size it from the outside, usually `className="h-full w-full"` to fill its parent.'
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
            text: "Two slots, two flavors each. Per-screen bars (`topBar`, `bottomBar`) mount and unmount with the screen. Shared bars (`sharedTopBar`, `sharedBottomBar`) are kept out of the transition, so they do not animate on every push. Use shared bars for global UI like a bottom tab bar."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  topBar={<TopBar title="Inbox" />}\n  sharedBottomBar={<TabBar />}\n>\n  <MailList />\n</Screen>'
          },
          {
            type: "note",
            text: "A shared bar overlaps with `Slot` (see the previous page), but they fit different cases. `Slot` puts one element, the same on every screen, outside the screen stack, so it never moves with a transition. A shared bar belongs to each screen, but when you move between two screens that both have one it is left out of the transition and stays in place, so its contents can differ from screen to screen. Use `Slot` for a fixed frame that is identical everywhere, and a shared bar for a per-screen bar that should still look continuous."
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
          { type: "h", text: "All props" },
          {
            type: "table",
            headers: ["Prop", "Type", "Default"],
            rows: [
              ["`topBar` / `bottomBar`", "`ReactNode`", "—"],
              ["`sharedTopBar` / `sharedBottomBar`", "`ReactNode`", "—"],
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
            text: "The playground's `wipe` transition puts this to work. It is a custom transition you author yourself, not a preset. The entering screen is revealed by a `clip-path` that opens left to right, while the screen underneath recedes with a little scale and opacity."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createTransition } from "@flemo/react";\n\nconst EASE = [0.65, 0, 0.35, 1] as const;\n\nconst wipe = createTransition({\n  name: "wipe",\n  initial: { clipPath: "inset(0 0 0 100%)" },\n  idle: { value: { clipPath: "inset(0)", scale: 1, opacity: 1 }, options: { duration: 0 } },\n  enter: { value: { clipPath: "inset(0)" }, options: { duration: 0.45, ease: EASE } },\n  enterBack: { value: { clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.38, ease: EASE } },\n  exit: { value: { scale: 0.96, opacity: 0.8 }, options: { duration: 0.45, ease: EASE } },\n  exitBack: { value: { scale: 1, opacity: 1 }, options: { duration: 0.38, ease: EASE } }\n});'
          },
          {
            type: "p",
            text: "The two `clip-path` endpoints deliberately use different templates, the four-value `inset(0 0 0 100%)` against the `inset(0)` shorthand, and it still tweens smoothly. This exact transition is live in the playground."
          },
          { type: "h", text: "Raw transitions and swipe" },
          {
            type: "p",
            text: "`createTransition` derives push, replace, and pop from one symmetric set of phases. When that is too coarse, `createRawTransition` is the low-level escape hatch: you spell out the entering and the leaving screen for every operation, so push can move differently from replace or pop."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createRawTransition } from "@flemo/react";\n\nexport const shove = createRawTransition({\n  name: "shove",\n  initial: { transform: "translateX(100%)" },\n  idle: { value: { transform: "translateX(0)" }, options: { duration: 0 } },\n  pushOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0.4 } },\n  pushOnExit: { value: { transform: "translateX(-30%)" }, options: { duration: 0.4 } },\n  replaceOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0.4 } },\n  replaceOnExit: { value: { transform: "translateX(-100%)" }, options: { duration: 0.4 } },\n  popOnEnter: { value: { transform: "translateX(-30%)" }, options: { duration: 0.4 } },\n  popOnExit: { value: { transform: "translateX(100%)" }, options: { duration: 0.4 } },\n  completedOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0 } },\n  completedOnExit: { value: { transform: "translateX(0)" }, options: { duration: 0 } }\n});'
          },
          {
            type: "p",
            text: "Any transition, preset or custom, becomes gesture-driven by setting `swipeDirection` and the swipe handlers in `options`. That is the same wiring behind cupertino's edge swipe-back."
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
            text: "The `options` block takes three imperative callbacks. Each fires with the element being dragged and lets you write styles to it directly."
          },
          {
            type: "table",
            headers: ["Hook", "Signature", "When it fires"],
            rows: [
              ["`onSwipeStart`", "`(triggered, { animate, element, active })`", "The drag begins"],
              [
                "`onSwipe`",
                "`(triggered, progress, { animate, element, active })`",
                "Every drag frame, `progress` running 0 to 100"
              ],
              [
                "`onSwipeEnd`",
                "`(triggered, { animate, element, active })`",
                "The drag releases; `triggered` is `true` if it committed, `false` if it was cancelled"
              ]
            ]
          },
          {
            type: "list",
            items: [
              "`progress` is the drag progress from 0 to 100",
              "`active` is `true` when the element sits on the current top screen, and `false` when it sits on the previous screen being revealed",
              "`animate(element, target, options?)` writes values to the element. Pass `{ duration: 0 }` inside `onSwipe` to follow the finger, and a short duration with an ease in `onSwipeEnd` to settle"
            ]
          },
          {
            type: "code",
            lang: "ts",
            code: 'const panelTitle = createPartTransition({\n  name: "panel-title",\n  initial: { opacity: 1, y: 0 },\n  idle: { value: { opacity: 1, y: 0 }, options: { duration: 0 } },\n  enter: { value: { opacity: 0.35, y: -10 }, options: { duration: 0.6, ease: EASE } },\n  exit: { value: { opacity: 1, y: 0 }, options: { duration: 0.6, ease: EASE } },\n  options: {\n    onSwipe: (_, progress, { animate, element, active }) => {\n      if (active) return;\n      const recovered = Math.min(1, Math.max(0, progress / 100));\n      animate(\n        element,\n        { opacity: 0.35 + 0.65 * recovered, y: -10 * (1 - recovered) },\n        { duration: 0 }\n      );\n    },\n    onSwipeEnd: (triggered, { animate, element, active }) => {\n      if (active) return;\n      animate(element, triggered ? { opacity: 1, y: 0 } : { opacity: 0.35, y: -10 }, {\n        duration: 0.3,\n        ease: EASE\n      });\n    }\n  }\n});'
          },
          {
            type: "p",
            text: "The `if (active) return;` at the top of each hook is the key move. During a swipe-back the top screen is leaving and the previous screen is coming back, so only the previous screen's part needs to recover with the drag. The active side just rides its own screen untouched, so its hooks bail out early. `onSwipe` maps the drag `progress` onto the title's opacity and offset every frame, and `onSwipeEnd` settles the rest based on whether the swipe committed. This exact motion is live in the playground."
          },
          {
            type: "note",
            text: "For finer control over each operation, `createRawPartTransition` exposes every status the way `createRawTransition` does: `idle`, `pushOnEnter` / `pushOnExit`, `replaceOnEnter` / `replaceOnExit`, `popOnEnter` / `popOnExit`, and `completedOnEnter` / `completedOnExit`."
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
              ["`RegisterDecorator`", "Register custom decorator names"],
              ["`RegisterPartTransition`", "Register custom part transition names"]
            ]
          },
          { type: "h", text: "Peer dependencies" },
          {
            type: "p",
            text: "`@flemo/react` requires only `react ^19` and `react-dom ^19`. Shared-element transitions are the one thing that needs more: `@flemo/react-layout` with `motion ^12`, added only when you reach for them."
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
          { type: "p", text: "flemo는 화면 전환을 위한 라우터예요." },
          {
            type: "p",
            text: "네이티브 앱은 화면을 쌓고(push) 걷어내고(pop), 스와이프로 뒤로 가며 움직여요. flemo는 그 움직임을 웹에서 그대로 만들 수 있게 도와줘요."
          },
          {
            type: "p",
            text: "화면 사이의 전환은 기본으로 제공되는 트랜지션을 바로 사용하거나, 직접 정의해서 사용할 수 있어요."
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
          { type: "h", text: "설치" },
          { type: "code", lang: "bash", code: "pnpm add @flemo/react" },
          {
            type: "note",
            text: "Svelte, SolidJS 지원도 준비 중이에요."
          },
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
              ]
            ]
          },
          { type: "h", text: "중첩 Router와 history 모드" },
          {
            type: "p",
            text: '`Router` 안의 `Router`는 자기 스택을 가진 독립 영역이에요. 기본적으로 그 안에서도 브라우저 히스토리를 사용해서 URL이 바뀌고 브라우저 뒤로/앞으로가 동작해요. 임베드된 데모, 위저드, 캐러셀처럼 URL이나 브라우저 뒤로가기를 건드리면 안 되는 격리 스택이 필요하면 `history="memory"`를 주세요.'
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
            text: '`Slot`은 화면이 그 안에서 움직이는 박스예요. 자기 영역으로 잘라내고 화면을 absolute로 쌓기 때문에, 크기를 명시하지 않으면 높이가 0으로 줄어 아무것도 안 보일 수 있어요. 보통 부모를 채우도록 바깥에서 `className="h-full w-full"`로 크기를 주세요.'
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
            text: "슬롯 둘, 각각 두 종류예요. 화면별 바(`topBar`, `bottomBar`)는 화면과 함께 마운트·언마운트돼요. 공유 바(`sharedTopBar`, `sharedBottomBar`)는 전환에서 빠져서 push마다 애니메이션되지 않아요. 하단 탭 바 같은 전역 UI에 공유 바를 사용해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: '<Screen\n  topBar={<TopBar title="Inbox" />}\n  sharedBottomBar={<TabBar />}\n>\n  <MailList />\n</Screen>'
          },
          {
            type: "note",
            text: "공유 바는 이전 페이지의 `Slot`과 겹쳐 보이지만 용도가 달라요. `Slot`은 모든 화면에 공통인 요소 하나를 화면 스택 바깥에 두어서, 화면이 바뀌어도 함께 움직이지 않고 늘 제자리에 있어요. 공유 바는 화면마다 각자 가지되, 바를 둘 다 가진 화면끼리 오갈 땐 전환에서 빠져 제자리에 그대로 보여요. 그래서 바 안의 내용은 화면마다 달라도 돼요. 어느 화면에서나 똑같은 고정 틀이면 `Slot`을, 화면마다 내용은 달라도 끊김 없이 이어져 보여야 하는 바면 공유 바를 사용하세요."
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
          { type: "h", text: "전체 props" },
          {
            type: "table",
            headers: ["Prop", "타입", "기본값"],
            rows: [
              ["`topBar` / `bottomBar`", "`ReactNode`", "—"],
              ["`sharedTopBar` / `sharedBottomBar`", "`ReactNode`", "—"],
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
              ["`layoutId`", '`transitionName: "layout"`과 짝지어 공유 요소 모핑'],
              ["`skip` / `until`", "한 번의 전환으로 여러 화면 건너뛰기"]
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
              ["`layout`", "layoutId 모핑에 맞춘 옅은 페이드"],
              ["`none`", "즉시 컷, 애니메이션 없음"]
            ]
          },
          {
            type: "p",
            text: "`Router`에 전역 기본값을 두거나, 이동마다 `transitionName`으로 재정의해요."
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
            text: "플레이그라운드의 `wipe` 트랜지션이 이걸 실제로 보여줘요. 프리셋이 아니라 직접 만드는 커스텀 트랜지션이에요. 들어오는 화면이 왼쪽에서 오른쪽으로 열리는 `clip-path`로 드러나고, 그 아래 화면은 살짝 축소되고 흐려지며 물러나요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createTransition } from "@flemo/react";\n\nconst EASE = [0.65, 0, 0.35, 1] as const;\n\nconst wipe = createTransition({\n  name: "wipe",\n  initial: { clipPath: "inset(0 0 0 100%)" },\n  idle: { value: { clipPath: "inset(0)", scale: 1, opacity: 1 }, options: { duration: 0 } },\n  enter: { value: { clipPath: "inset(0)" }, options: { duration: 0.45, ease: EASE } },\n  enterBack: { value: { clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.38, ease: EASE } },\n  exit: { value: { scale: 0.96, opacity: 0.8 }, options: { duration: 0.45, ease: EASE } },\n  exitBack: { value: { scale: 1, opacity: 1 }, options: { duration: 0.38, ease: EASE } }\n});'
          },
          {
            type: "p",
            text: "두 `clip-path` 끝점은 일부러 다른 템플릿을 써요. 네 값짜리 `inset(0 0 0 100%)`과 `inset(0)` 단축형인데도 매끄럽게 트위닝돼요. 이 트랜지션 그대로가 플레이그라운드에 살아 있어요."
          },
          { type: "h", text: "Raw 트랜지션과 스와이프" },
          {
            type: "p",
            text: "`createTransition`은 push·replace·pop을 하나의 대칭 phase 세트에서 끌어내요. 그게 너무 뭉뚱그려질 때 `createRawTransition`이 저수준 탈출구예요. 들어오는 화면과 나가는 화면을 작업(push·replace·pop)마다 직접 다 적어서, push가 replace나 pop과 다르게 움직이게 할 수 있어요."
          },
          {
            type: "code",
            lang: "ts",
            code: 'import { createRawTransition } from "@flemo/react";\n\nexport const shove = createRawTransition({\n  name: "shove",\n  initial: { transform: "translateX(100%)" },\n  idle: { value: { transform: "translateX(0)" }, options: { duration: 0 } },\n  pushOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0.4 } },\n  pushOnExit: { value: { transform: "translateX(-30%)" }, options: { duration: 0.4 } },\n  replaceOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0.4 } },\n  replaceOnExit: { value: { transform: "translateX(-100%)" }, options: { duration: 0.4 } },\n  popOnEnter: { value: { transform: "translateX(-30%)" }, options: { duration: 0.4 } },\n  popOnExit: { value: { transform: "translateX(100%)" }, options: { duration: 0.4 } },\n  completedOnEnter: { value: { transform: "translateX(0)" }, options: { duration: 0 } },\n  completedOnExit: { value: { transform: "translateX(0)" }, options: { duration: 0 } }\n});'
          },
          {
            type: "p",
            text: "preset이든 커스텀이든 `options`에 `swipeDirection`과 스와이프 핸들러를 주면 제스처로 끌 수 있어요. 내장 cupertino 엣지 스와이프 뒤로가기가 바로 그 방식이에요."
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
            text: "`options` 블록은 명령형 콜백 세 개를 받아요. 각각 드래그 중인 요소와 함께 호출되고, 그 요소에 직접 스타일을 쓸 수 있어요."
          },
          {
            type: "table",
            headers: ["훅", "시그니처", "호출 시점"],
            rows: [
              [
                "`onSwipeStart`",
                "`(triggered, { animate, element, active })`",
                "드래그가 시작될 때"
              ],
              [
                "`onSwipe`",
                "`(triggered, progress, { animate, element, active })`",
                "드래그하는 매 프레임, `progress`는 0에서 100까지"
              ],
              [
                "`onSwipeEnd`",
                "`(triggered, { animate, element, active })`",
                "드래그를 놓을 때. 커밋됐으면 `triggered`가 `true`, 취소됐으면 `false`"
              ]
            ]
          },
          {
            type: "list",
            items: [
              "`progress`는 0에서 100까지의 드래그 진행도예요",
              "`active`는 요소가 현재 맨 위 화면에 있으면 `true`, 드러나는 이전 화면에 있으면 `false`예요",
              "`animate(element, target, options?)`는 요소에 값을 써요. `onSwipe` 안에서 `{ duration: 0 }`을 주면 손가락을 따라가고, `onSwipeEnd`에서 짧은 duration과 ease를 주면 안착해요"
            ]
          },
          {
            type: "code",
            lang: "ts",
            code: 'const panelTitle = createPartTransition({\n  name: "panel-title",\n  initial: { opacity: 1, y: 0 },\n  idle: { value: { opacity: 1, y: 0 }, options: { duration: 0 } },\n  enter: { value: { opacity: 0.35, y: -10 }, options: { duration: 0.6, ease: EASE } },\n  exit: { value: { opacity: 1, y: 0 }, options: { duration: 0.6, ease: EASE } },\n  options: {\n    onSwipe: (_, progress, { animate, element, active }) => {\n      if (active) return;\n      const recovered = Math.min(1, Math.max(0, progress / 100));\n      animate(\n        element,\n        { opacity: 0.35 + 0.65 * recovered, y: -10 * (1 - recovered) },\n        { duration: 0 }\n      );\n    },\n    onSwipeEnd: (triggered, { animate, element, active }) => {\n      if (active) return;\n      animate(element, triggered ? { opacity: 1, y: 0 } : { opacity: 0.35, y: -10 }, {\n        duration: 0.3,\n        ease: EASE\n      });\n    }\n  }\n});'
          },
          {
            type: "p",
            text: "각 훅 맨 위의 `if (active) return;`이 핵심이에요. 스와이프 뒤로 중에는 맨 위 화면이 나가고 이전 화면이 돌아오므로, 드래그에 맞춰 회복해야 하는 건 이전 화면의 파트뿐이에요. 활성 쪽은 자기 화면을 따라 움직이면 그만이라 훅에서 일찍 빠져나와요. `onSwipe`는 드래그 `progress`를 타이틀의 opacity와 위치에 매 프레임 매핑하고, `onSwipeEnd`는 스와이프가 커밋됐는지에 따라 나머지를 안착시켜요. 이 움직임 그대로가 플레이그라운드에 살아 있어요."
          },
          {
            type: "note",
            text: "작업별로 더 세밀히 제어하려면 `createRawPartTransition`이 `createRawTransition`처럼 모든 status를 열어줘요: `idle`, `pushOnEnter`·`pushOnExit`, `replaceOnEnter`·`replaceOnExit`, `popOnEnter`·`popOnExit`, `completedOnEnter`·`completedOnExit`요."
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
              ["`RegisterTransition`", "커스텀 트랜지션 이름 등록"],
              ["`RegisterDecorator`", "커스텀 데코레이터 이름 등록"],
              ["`RegisterPartTransition`", "커스텀 파트 트랜지션 이름 등록"]
            ]
          },
          { type: "h", text: "Peer 의존성" },
          {
            type: "p",
            text: "`@flemo/react`는 `react ^19`, `react-dom ^19`만 필요해요. 더 필요한 건 공유 요소 전환 하나뿐이에요. 그때만 `@flemo/react-layout`이 `motion ^12`을 함께 요구하니, 그 전환이 필요할 때 설치하면 돼요."
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
            text: "`@flemo/react-layout`은 실험적이에요. 두 화면이 같은 요소를 공유할 때만 사용하세요."
          },
          {
            type: "p",
            text: "`LayoutScreen`은 `Screen`을 대체하면서 이동 중 공유 요소 모핑을 더해요. 목록의 썸네일이 다음 화면의 큰 이미지로 펼쳐졌다가, 뒤로 가면 다시 접혀요. iOS의 사진·뮤직이 사용하는 동작이고, Material 3은 컨테이너 트랜스폼이라 불러요."
          },
          {
            type: "p",
            text: "별도 패키지 `@flemo/react-layout`에 있고 `motion`이 peer 의존성이라, 모핑하지 않는 앱은 비용을 안 내요."
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
            text: "출발 화면은 모핑할 트리를 `LayoutConfig`로 감싸고, 각 요소에 공유 `layoutId`를 달고, `layout` 트랜지션으로 push해요."
          },
          {
            type: "code",
            lang: "tsx",
            code: 'import { Screen, useNavigate } from "@flemo/react";\nimport { LayoutConfig } from "@flemo/react-layout";\nimport { motion } from "motion/react";\n\nfunction Gallery() {\n  const navigate = useNavigate();\n  const open = (p) =>\n    navigate.push("/photos/:id", { id: p.id }, { transitionName: "layout", layoutId: p.id });\n\n  return (\n    <Screen>\n      <LayoutConfig>\n        {photos.map((p) => (\n          <motion.li key={p.id} layoutId={`photo-card-${p.id}`} onClick={() => open(p)}>\n            <motion.img layoutId={`photo-image-${p.id}`} src={p.thumb} />\n          </motion.li>\n        ))}\n      </LayoutConfig>\n    </Screen>\n  );\n}'
          },
          {
            type: "p",
            text: "도착 화면은 `Screen` 대신 `LayoutScreen`을 사용하고, `useScreen().layoutId`로 같은 id를 다시 만들고, `fixed inset-0` 컨테이너를 화면 가득 모핑해요."
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
