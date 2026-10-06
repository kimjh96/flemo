# @flemo/react architecture

`@flemo/react` binds React to `@flemo/core`. Core owns imperative, reusable behavior: task queues, stores, the engine, compiled styles, and gesture math. React renders the declarative state—data attributes and inline styles—that the engine reads, and calls core at React lifecycle boundaries.

## Design map

- [Router](./react-binding/router.md): stores, history, scope targeting, publication timing, hydration, and lifetime.
- [ScreenMotion](./react-binding/screen-motion.md): engine lifecycle, holds, swipes, bars, styles, and layer promotion.
- [Screen and freeze](./react-binding/screen-freeze.md): Activity lifetime, deferred freezing, and bar registration.
- [Rendering, parts, morphs, and hooks](./react-binding/rendering.md): stack rendering, outer Parts, shared elements, and scope coordination.
- [Ownership and protocol](./react-binding/ownership-and-protocol.md): runtime ownership, platform decisions, DOM protocol, and evidence boundaries.
- [Implementation and validation rules](./react-binding/implementation-and-validation.md): imports, first-paint state, and tests.
