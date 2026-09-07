<div align="center">
<img width="96" height="96" alt="flemo" src="https://github.com/user-attachments/assets/1d0059ef-8fcc-456c-be42-7e3f08dee453" />

<h1>flemo</h1>

**Native-like screen transitions for the web**

[![npm](https://img.shields.io/npm/v/@flemo/react.svg)](https://www.npmjs.com/package/@flemo/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

flemo is a router whose unit of routing is a **screen**, not a page. Push, pop, and the
animations and gestures between them belong to the router, so an app does not have to wire a
routing library and an animation library together and then keep their timing in agreement.

## Install

```bash
pnpm add @flemo/react
```

`@flemo/react` needs `react ^19` and `react-dom ^19`, and nothing else. `@flemo/core` comes
along as a regular dependency.

## Example

```tsx
import { Route, Router, Screen, useNavigate } from "@flemo/react";

function Home() {
  const navigate = useNavigate();

  return (
    <Screen>
      <h1>Home</h1>
      <button onClick={() => navigate.push("/posts/:slug", { slug: "hello" })}>Open hello</button>
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

Augment `RegisterRoute` once and TypeScript checks every path and params object:

```ts
declare module "@flemo/react" {
  interface RegisterRoute {
    "/": undefined;
    "/posts/:slug": { slug: string };
  }
}
```

Browser Back, `navigate.pop()`, and a drag from the left edge each pop the pushed screen.

## What ships in this package

`Router` and `Route` own the stack. `Screen` is the unit that moves, and it takes the shared
top and bottom bars that hand over between screens. `Morph` pairs one element across two
screens by `layoutId` so it travels instead of appearing. `Part` runs a named transition on a
single element inside a screen. `Layer` renders an overlay beside the screen so a sheet can
cover the shared bars while the screen moves. The `useNavigate`, `useScreen`, `useParams`,
`usePathname`, and `useStep` hooks read and drive all of it.

## Packages

| Package           | Published | What it is                                                                                                                                                                                                  |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@flemo/react`    | yes       | The React binding. Install this one.                                                                                                                                                                        |
| `@flemo/core`     | yes       | Framework-agnostic primitives: the navigation task queue, the stores, transition factories and presets, the keyframes compiler, and the morph runtime. Install it directly only to use those without React. |
| `@flemo/devtools` | yes       | Zero-dependency flight recorder and visual panel. It observes the `data-flemo-*` surfaces the engine already exposes and imports neither package above, so attaching it does not change measured motion.    |

Svelte and SolidJS bindings are planned. There is no `flemo` meta package.

## Documentation

[flemo.dev](https://flemo.dev) carries the full guide in English and Korean: getting started,
transitions, shared-element morphs, gestures, and the API reference. The live playground is at
[flemo.dev/playground](https://flemo.dev/playground).

## Contributing

The source lives at [github.com/kimjh96/flemo](https://github.com/kimjh96/flemo), a pnpm and
Turborepo monorepo. `pnpm turbo run typecheck lint test build` from the repository root is the
gate every change passes before it lands, and `AGENTS.md` holds the working rules: the layout,
where each kind of change belongs, and how releases are cut with Changesets.

## License

MIT © [kimjh96](https://github.com/kimjh96)
