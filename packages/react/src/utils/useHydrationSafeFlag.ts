import { useSyncExternalStore } from "react";

// Read a BROWSER-ONLY boolean (sessionStorage, navigator, devicePixelRatio, a
// learned session verdict) from a component that may be server-rendered.
//
// The problem it solves: the server has none of that state, so any render-phase
// read makes the server HTML and the client's HYDRATION render disagree. When
// the value reaches the DOM — flemo's case is the screen scope's inline
// `will-change: transform` — React reports a hydration mismatch on the style
// attribute and throws the whole subtree away to re-render it client-side. The
// only flemo state that reaches the DOM through an inline style is exactly this
// class of value.
//
// `useSyncExternalStore`'s third argument is the fix React itself defines:
// React uses the SERVER snapshot both on the server AND for the hydration
// render, then re-reads the live snapshot in the post-hydration effect and
// re-renders if it moved. So server HTML and first client render are identical
// BY CONSTRUCTION (constant `false`), and the browser-derived value lands one
// commit later — at rest, before any transition can exist.
//
// Why not `useState(false)` + `useEffect(() => setState(true))`: that latch is
// per-component and unconditional, so a screen MOUNTED LATER (every push/
// replace destination) would also render its first frame unpromoted and only
// gain the layer a commit after the flight started — losing the promotion on
// exactly the frames it exists for. A module-level latch flipped by the first
// mount has the mirror bug: with selective hydration a still-hydrating screen
// would read it as already true and mismatch anyway. React's hydration-scoped
// snapshot is per-component and knows which of the two situations it is in: a
// client-side mount never takes the server-snapshot path, so a pushed screen
// reads the live value on its FIRST render, exactly as before this hook.
//
// `read` must be module-stable (React resubscribes when the arguments change)
// and pure. There is no subscription: the flags this gates are session-scoped
// state nothing publishes an event for, and React re-invokes `read` on every
// render anyway — so a DevTools toggle still takes effect on the next render,
// which is the uncached semantics the flag registry documents.
const subscribe = () => () => {};

const serverSnapshot = () => false;

export default function useHydrationSafeFlag(read: () => boolean): boolean {
  return useSyncExternalStore(subscribe, read, serverSnapshot);
}
