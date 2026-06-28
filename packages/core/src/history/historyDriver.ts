// The browser-history surface flemo's navigation engine depends on, behind one
// injectable seam. The default is the real `window.history` / `popstate` /
// `window.location` (see `createBrowserHistoryDriver`), used by a root <Router>.
// A nested <Router> (a transition region inside a persistent layout) can inject
// an in-memory driver instead, so its navigation runs in its own local stack
// without touching the browser's single back/forward history.
//
// Keeping this a seam also pulls the only DOM globals out of the otherwise
// framework-neutral navigation core: the engine talks to this interface, not
// `window`.

// What a back/forward (popstate-equivalent) event carries: the flemo frame
// stored by a prior push/replace, plus the pathname now in effect.
export interface HistoryNavEvent {
  state: unknown;
  pathname: string;
}

export interface HistoryDriver {
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

// The default driver: the real browser History API. Stateless over the global
// `window`, so callers may create their own instance freely.
export default function createBrowserHistoryDriver(): HistoryDriver {
  return {
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
