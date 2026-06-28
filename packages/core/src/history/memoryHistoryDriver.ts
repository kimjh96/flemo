import type { HistoryDriver, HistoryNavEvent } from "@history/historyDriver";

interface MemoryHistoryEntry {
  state: unknown;
  url: string;
}

// An in-memory History API, for a nested <Router> (a transition region inside a
// persistent layout) whose navigation must stay local and never touch the
// browser's single back/forward stack. It emulates the browser model the
// navigation engine is written against — a stack with a current index, a
// forward-truncating push, and a `go`/`back` that fires a popstate-equivalent
// asynchronously — so `createNavigationController` / `createHistorySync` run
// unchanged over it.
export default function createMemoryHistoryDriver(initial?: {
  state?: unknown;
  url?: string;
}): HistoryDriver {
  const entries: MemoryHistoryEntry[] = [
    { state: initial?.state ?? null, url: initial?.url ?? "/" }
  ];
  let index = 0;
  const listeners = new Set<(event: HistoryNavEvent) => void>();

  // Fire the popstate-equivalent for the current entry on a microtask, matching
  // the browser deferring popstate past the synchronous `go`/`back` call. The
  // engine's collapse-sync awaits this, racing a timeout, so it must be async.
  const emit = () => {
    const entry = entries[index];
    const event: HistoryNavEvent = { state: entry.state, pathname: entry.url };
    queueMicrotask(() => {
      for (const listener of listeners) listener(event);
    });
  };

  return {
    pushState: (state, url) => {
      // Truncate the forward stack, then stack the new entry as the current one.
      entries.splice(index + 1);
      entries.push({ state, url });
      index = entries.length - 1;
    },
    replaceState: (state, url) => {
      entries[index] = { state, url };
    },
    go: (delta) => {
      const target = Math.min(Math.max(index + delta, 0), entries.length - 1);
      // No movement (delta 0 or out of bounds) fires no popstate, as in the browser.
      if (target === index) return;
      index = target;
      emit();
    },
    back: () => {
      if (index === 0) return;
      index -= 1;
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}
