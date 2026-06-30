// The browser-history surface flemo's navigation engine depends on, behind one
// injectable seam. The default is the real `window.history` / `popstate` /
// `window.location` (see `createBrowserHistoryDriver`), used by a <Router>.
// A nested <Router> can opt into an in-memory driver instead (history="memory"),
// so its navigation runs in its own local stack without touching the browser's
// single back/forward history.
//
// Keeping this a seam also pulls the only DOM globals out of the otherwise
// framework-neutral navigation core: the engine talks to this interface, not
// `window`.
//
// `window.history` is singular: one URL, one `history.state`, one popstate
// stream. So two browser Routers on a page must not clobber each other's
// `history.state`. A keyed browser driver namespaces its frame under a stable
// `routerKey`: pushState/replaceState MERGE `{ ...currentState, [routerKey]:
// frame }`, and subscribe delivers only `state[routerKey]` to the listener. A
// nested Router's push then preserves the parent's key in the same entry, and
// vice versa, so on back each Router reads its own frame correctly.

// What a back/forward (popstate-equivalent) event carries: the flemo frame
// stored by a prior push/replace, plus the pathname now in effect.
export interface HistoryNavEvent {
  state: unknown;
  pathname: string;
}

export interface HistoryDriver {
  // Read this Router's current frame (the keyed driver returns `state[routerKey]`,
  // the keyless/memory drivers the whole stored state). Lets a caller build the
  // next frame from the current one without reaching into `window.history.state`
  // and missing the keying.
  readState(): unknown;
  // Read the current pathname this Router should seed/match against. The default
  // browser driver returns `window.location.pathname`; a wrapping driver (e.g. a
  // locale-aware one) can translate it, so the Router never reads `window`
  // directly and the driver fully owns the URL surface.
  readPathname(): string;
  // Stack the new entry (truncating any forward entries), mapping to
  // `history.pushState(state, "", url)`.
  pushState(state: unknown, url: string): void;
  // Overwrite the current entry, mapping to `history.replaceState(state, "", url)`.
  replaceState(state: unknown, url: string): void;
  // Traverse `delta` entries (negative = back), mapping to `history.go(delta)`.
  go(delta: number): void;
  // Traverse one entry back, mapping to `history.back()`.
  back(): void;
  // Subscribe to back/forward traversals (popstate-equivalent). Returns a
  // disposer. The engine also uses this for a one-shot wait after a `go`.
  subscribe(listener: (event: HistoryNavEvent) => void): () => void;
}

// Merge this Router's frame under its key into the current `window.history.state`,
// preserving any sibling Router's frame already stored in the same entry.
const mergeKeyedState = (routerKey: string, frame: unknown): Record<string, unknown> => ({
  ...((window.history.state as Record<string, unknown> | null) ?? {}),
  [routerKey]: frame
});

// The default driver: the real browser History API. Stateless over the global
// `window`, so callers may create their own instance freely.
//
// With a `routerKey`, state is namespaced under that key (push/replace merge,
// subscribe extracts the key) so multiple browser Routers coexist. Without one,
// the frame is stored bare as the whole `history.state` (the keyless form kept
// for back-compat and tests).
export default function createBrowserHistoryDriver(routerKey?: string): HistoryDriver {
  if (routerKey === undefined) {
    return {
      readState: () => window.history.state,
      readPathname: () => window.location.pathname,
      pushState: (state, url) => window.history.pushState(state, "", url),
      replaceState: (state, url) => window.history.replaceState(state, "", url),
      go: (delta) => window.history.go(delta),
      back: () => window.history.back(),
      subscribe: (listener) => {
        const handler = (event: PopStateEvent) =>
          listener({ state: event.state, pathname: window.location.pathname });
        window.addEventListener("popstate", handler);
        return () => window.removeEventListener("popstate", handler);
      }
    };
  }

  return {
    readState: () => (window.history.state as Record<string, unknown> | null)?.[routerKey] ?? null,
    readPathname: () => window.location.pathname,
    pushState: (state, url) => window.history.pushState(mergeKeyedState(routerKey, state), "", url),
    replaceState: (state, url) =>
      window.history.replaceState(mergeKeyedState(routerKey, state), "", url),
    go: (delta) => window.history.go(delta),
    back: () => window.history.back(),
    subscribe: (listener) => {
      const handler = (event: PopStateEvent) =>
        listener({
          state: (event.state as Record<string, unknown> | null)?.[routerKey] ?? null,
          pathname: window.location.pathname
        });
      window.addEventListener("popstate", handler);
      return () => window.removeEventListener("popstate", handler);
    }
  };
}
