<div align="center">
<img width="96" height="96" alt="flemo" src="https://github.com/user-attachments/assets/1d0059ef-8fcc-456c-be42-7e3f08dee453" />

<h1>flemo</h1>

**Native-like screen transitions for React**

[![npm](https://img.shields.io/npm/v/@flemo/react.svg)](https://www.npmjs.com/package/@flemo/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

flemo is a React router whose unit of routing is a **screen**, not a page. Push, pop, and the
animations and gestures between screens are handled by flemo, so you don't need to wire a
router and a motion library together yourself.

## Install

```bash
pnpm add @flemo/react
```

`@flemo/react` pulls in `@flemo/core` (the framework-agnostic primitives) as a regular
dependency. Apps that only need transition compilers or the navigation queue can install
`@flemo/core` directly. For shared-element morphs (`<LayoutScreen>` + `<LayoutConfig>`),
add `@flemo/react-layout` (which carries `motion` as its peer dependency):

```bash
pnpm add @flemo/react-layout motion
```

## Documentation

See [flemo-web.vercel.app](https://flemo-web.vercel.app) for the full guide — getting started,
transitions, shared-element morphs, gestures, and the complete API reference. A live playground is
at [flemo-web.vercel.app/playground](https://flemo-web.vercel.app/playground).

## License

MIT © [kimjh96](https://github.com/kimjh96)
