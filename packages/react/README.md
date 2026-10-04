<div align="center">
<img width="96" height="96" alt="flemo" src="https://flemo.dev/icon.svg" />

<h1>flemo</h1>

**Native-like screen transitions for React on the web**

[![npm](https://img.shields.io/npm/v/@flemo/react.svg)](https://www.npmjs.com/package/@flemo/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Docs](https://flemo.dev/docs) · [Playground](https://flemo.dev/playground) · [Showcase](https://flemo.dev/showcase)

</div>

---

flemo is a React router whose unit is a **screen**, not a page. Pushing, popping, the animation
between two screens and the swipe that takes you back are all handled by the router, so you do
not wire a routing library to an animation library and keep their timing in sync yourself.

## Install

```bash
pnpm add @flemo/react
```

`@flemo/react` needs `react` and `react-dom` 19.2.8 or later, and nothing else. `@flemo/core`
comes along as a regular dependency.

## Example

```tsx
import { Route, Router, Screen, useNavigate, useParams } from "@flemo/react";

function Home() {
  const navigate = useNavigate();

  return (
    <Screen>
      <h1>Home</h1>
      <button onClick={() => navigate.push("/posts/:slug", { slug: "hello" })}>Open hello</button>
    </Screen>
  );
}

function Post() {
  const { slug } = useParams<"/posts/:slug">();

  return (
    <Screen>
      <h1>{slug}</h1>
    </Screen>
  );
}

export default function App() {
  return (
    <Router>
      <Route path="/" element={<Home />} />
      <Route path="/posts/:slug" element={<Post />} />
    </Router>
  );
}
```

The pushed screen slides in with the `cupertino` transition. Browser Back, `navigate.pop()` and
a swipe from the left edge all take you back.

Declare your routes once and TypeScript checks every path and its params:

```ts
declare module "@flemo/react" {
  interface RegisterRoute {
    "/": undefined;
    "/posts/:slug": { slug: string };
  }
}
```

## What you get

- **Transitions.** Built-in `cupertino`, `material`, `layout` and `none`, or your own with
  `createTransition`. Pick a default on the `Router`, or a different one for a single push.
- **Swipe back.** The screen follows the finger. When you let go, the transition finishes on its
  own easing, or returns if the swipe was cancelled.
- **Compiled to CSS.** Transitions compile to CSS keyframes, so the browser runs the animation
  and no script runs on every frame of a push or pop.
- **Shared elements.** `Morph` pairs one element across two screens by `layoutId`, so a card
  grows into the next screen instead of appearing there.
- **Fixed headers with changing content.** Screens share a top or bottom bar that stays in
  place, and `Part` animates only what changes on it, such as the title.
- **Layout and overlays.** `Slot` keeps a header or sidebar still while only its region moves.
  `Layer` draws a menu or sheet above the shared bars. Decorators dim the previous screen during
  a transition.
- **Nested routers.** A tab, panel or sheet can have its own stack, kept out of the URL with
  `history="memory"`.

## Packages

| Package           | Published | What it is                                                                                                                                                                                                  |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@flemo/react`    | yes       | The React binding. Install this one.                                                                                                                                                                        |
| `@flemo/core`     | yes       | Framework-agnostic primitives: the navigation task queue, the stores, transition factories and presets, the keyframes compiler, and the morph runtime. Install it directly only to use those without React. |
| `@flemo/devtools` | yes       | Zero-dependency transition recorder and visual panel. It reads the `data-flemo-*` attributes the engine already exposes and imports neither package above, so attaching it does not change the motion.      |

Svelte and SolidJS bindings are planned. There is no `flemo` meta package.

## Documentation

[flemo.dev](https://flemo.dev/docs) has the full guide in English and Korean, with a live demo on
most pages:

- [Getting started](https://flemo.dev/docs/getting-started)
- [Router and Route](https://flemo.dev/docs/router), [Slot](https://flemo.dev/docs/slot),
  [Screen](https://flemo.dev/docs/screen), [Navigation](https://flemo.dev/docs/navigation)
- [Transitions](https://flemo.dev/docs/transitions), [Decorator](https://flemo.dev/docs/decorator),
  [Part](https://flemo.dev/docs/part), [Morph](https://flemo.dev/docs/morph),
  [Layer](https://flemo.dev/docs/layer)
- [Putting it together](https://flemo.dev/docs/composition): one app built step by step
- [API reference](https://flemo.dev/docs/api)

Try the presets on a real app in the [playground](https://flemo.dev/playground). For coding
agents, the same docs are available as [llms.txt](https://flemo.dev/llms.txt) and
[llms-full.txt](https://flemo.dev/llms-full.txt).

## Contributing

The source lives at [github.com/kimjh96/flemo](https://github.com/kimjh96/flemo), a pnpm and
Turborepo monorepo. `pnpm turbo run typecheck lint test build` from the repository root is the
gate every change passes before it lands, and `AGENTS.md` holds the working rules: the layout,
where each kind of change belongs, and how releases are cut with Changesets.

## License

MIT © [kimjh96](https://github.com/kimjh96)
