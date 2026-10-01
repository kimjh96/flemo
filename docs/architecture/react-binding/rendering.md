# Rendering, parts, morphs, and hooks

## Renderer

`Renderer.tsx` matches `histories` to `<Route>` declarations through `matchesPathname`/`getMatchedPathPattern`. Each rendered stack entry receives `ScreenContext` and `ParamsProvider`.

## Parts and decorator

`Part.tsx` wraps an element in a named part-transition. It carries its screen's status/active attributes and the Router marker via ScreenContext/RouterIdContext, allowing compiled selectors and engine variant queries to scope correctly.

A Part can live outside any screen, such as persistent chrome beside a `<Slot>` or a portal. The engine stamps the flight's anim-hold on these outer Parts: the compiled hold rule pauses only `[data-flemo-anim-hold] [data-flemo-part-name]` descendants. Without the stamp, an outer Part animates through the hold and leads the flight by the hold's entire duration. Parts inside screens or shared bars need no stamp because the binding places the hold attribute on both containers, covering their descendants.

The engine finds outer Parts through `data-flemo-router`, never by walking upward from the scope. Each screen has its own wrapper; that walk would see only the already-held screen subtree and silently cover nothing. The active side owns the stamp. Both flight screens carry a hold; two owners writing one persistent element would let the first release unhold it for the other.

`ScreenDecorator.tsx` renders the dim/decorator element through `decoratorMap`, using the same holds and engine joins.

## Morph

`Morph.tsx` and `MorphLayer/` implement a shared element: the same thing on two screens, paired by `layoutId`. `Morph.tsx` is deliberately twenty lines: it renders a slot and box and calls core's `attachMorph` in a layout effect. It re-registers on every status change, as required by the runtime contract; this lets an unfrozen previous screen participate in a pop.

Core's `src/morph` owns pairing, measured travel, per-flight keyframes, and cleanup. It reads the DOM PROTOCOL rather than stores, allowing a Solid or Svelte binding to use the same twenty-line approach.

Four contracts govern the binding:

1. During flight, the element moves into `MorphLayer` and returns on landing. Router renders the layer because only it knows whether its box is the viewport or a contained region. Remaining inside a screen would clip, cover, and drag the element with that screen; leaving the descendant relationship avoids all three. A morph therefore requires no particular screen transition.
2. The slot protects React: React must never remove a node from a location other than where it left it. The slot stays in place and takes removal while the box flies. At rest it uses `display: contents`.
3. On POP, the arriving screen has `data-flemo-active="false"`. The flag follows stack position, not travel direction; the dismissing screen retains `"true"` until landing.
4. The layer mirrors the arriving screen's `data-flemo-anim-hold`. The same compiled rule pauses the morph and screen, starting both on the same frame without timing code on either side.

## Hooks and scope coordination

- Navigation: `useNavigate`, `usePathname`, `useStep`.
- Screen identity/role: `useScreen`.
- Parameters: `useParams`.
- Store hooks: `useHistoryStore` and others use zustand selectors over the scope bundle.
- Keyboard detection: `useViewportScrollHeight` hides bottom chrome.

`scopeAnimHoldCoordinator.ts` provides a per-scope coordinator singleton in a WeakMap keyed by the navigate store. Nested Routers must never share a pop pair-release group.
