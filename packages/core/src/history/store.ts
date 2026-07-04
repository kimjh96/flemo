import { createStore, type StoreApi } from "zustand/vanilla";

import type { TransitionName } from "@transition/typing";

export interface History {
  id: string;
  pathname: string;
  params: object;
  transitionName: TransitionName;
  layoutId: string | number | null;
  // This entry's position stamp in the BROWSER's history line, chained from the
  // entry it was created on top of (previous frame's stamp + 1) and mirrored
  // into the keyed browser frame. The local `index` is this store's own
  // compressed space (a traversal into unread territory adds one entry no
  // matter how many the browser crossed), so after such a jump the two spaces
  // disagree forever — direction judgments for entries we've never held MUST
  // compare browser stamps, never local indexes. Optional: entries predating
  // this field fall back to their local index.
  frameIndex?: number;
}

export interface HistoryStore {
  index: number;
  // The destination index of the in-flight navigation. It equals `index` at rest
  // and on push/replace, but on a pop it advances to the target IMMEDIATELY
  // (while `index` stays on the leaving screen until the transition completes, so
  // the renderer keeps it mounted). Reads of "where am I now" (usePathname) use
  // this so pop reports its destination at once, like push does.
  pendingIndex: number;
  histories: History[];
  addHistory: (history: History) => void;
  replaceHistory: (index: number) => void;
  popHistory: (index: number) => void;
  popHistories: (count: number) => void;
  // Point pendingIndex at a pop's destination before the transition resolves.
  setPendingIndex: (index: number) => void;
  // Rewrite the CURRENT top entry (and drop anything stacked above it) to the
  // given entry, without moving the index — the history-sync's no-animation
  // adoption for a traversal it cannot faithfully classify (see
  // createHistorySync). The renderer swaps the screen's content in place.
  adoptHistory: (history: History) => void;
  // Cut the stack down to `position` (inclusive) without a transition — the
  // convergence step a queued navigation runs when the browser has moved to an
  // entry we hold below the top since the action was issued.
  truncateHistory: (position: number) => void;
  setTransitionName: (index: number, transitionName: TransitionName) => void;
}

export type HistoryStoreApi = StoreApi<HistoryStore>;

// Request-scoped: the Router creates one per mount, seeded from initPath. Seeding at creation
// (rather than via setState afterward) means `getInitialState()` (what zustand hands React as
// the SSR snapshot) already holds the root frame, so the screen paints on the server and each
// concurrent request gets its own stack.
export default function createHistoryStore(histories: History[] = [], index = -1): HistoryStoreApi {
  return createStore<HistoryStore>((set) => ({
    index,
    pendingIndex: index,
    histories,
    addHistory: (history) =>
      set((state) => ({
        index: state.index + 1,
        pendingIndex: state.index + 1,
        histories: state.histories.concat(history)
      })),
    replaceHistory: (index) =>
      set((state) => {
        state.histories.splice(index, 1);

        return {
          index: state.index - 1,
          pendingIndex: state.index - 1,
          histories: state.histories
        };
      }),
    popHistory: (index) =>
      set((state) => ({
        index: state.index - 1,
        pendingIndex: state.index - 1,
        histories: state.histories.filter((_, i) => i !== index)
      })),
    // Drop `count` entries sitting directly below the current top, keeping the
    // top itself. Used by pop(n) to remove the screens it skips over in the same
    // synchronous block that starts the transition (so they never paint) while
    // the leaving top stays mounted to drive and resolve the animation.
    popHistories: (count) => {
      if (count <= 0) return;
      set((state) => {
        const top = state.index;
        return {
          index: state.index - count,
          pendingIndex: state.index - count,
          histories: state.histories.filter((_, i) => i < top - count || i >= top)
        };
      });
    },
    setPendingIndex: (index) => set({ pendingIndex: index }),
    adoptHistory: (history) =>
      set((state) => ({
        histories: state.histories.slice(0, state.index).concat(history)
      })),
    truncateHistory: (position) =>
      set((state) => ({
        index: position,
        pendingIndex: position,
        histories: state.histories.slice(0, position + 1)
      })),

    // Override one entry's transition. Used by pop() to relabel the leaving top
    // before the POPPING flip so the back animation uses the caller's
    // `transitionName` from the first frame. Its original transition never
    // paints. Returns a fresh array so the renderer re-reads it.
    setTransitionName: (index, transitionName) =>
      set((state) => {
        const target = state.histories[index];
        if (!target || target.transitionName === transitionName) return {};

        const histories = state.histories.slice();
        histories[index] = { ...target, transitionName };
        return { histories };
      })
  }));
}
