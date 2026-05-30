import { create } from "zustand";

import type { TransitionName } from "@transition/typing";

export interface History {
  id: string;
  pathname: string;
  params: object;
  transitionName: TransitionName;
  layoutId: string | number | null;
}

interface HistoryStore {
  index: number;
  histories: History[];
  addHistory: (history: History) => void;
  replaceHistory: (index: number) => void;
  popHistory: (index: number) => void;
  popHistories: (count: number) => void;
  setTransitionName: (index: number, transitionName: TransitionName) => void;
}

const useHistoryStore = create<HistoryStore>((set) => ({
  index: -1,
  histories: [],
  addHistory: (history) =>
    set((state) => ({
      index: state.index + 1,
      histories: state.histories.concat(history)
    })),
  replaceHistory: (index) =>
    set((state) => {
      state.histories.splice(index, 1);

      return {
        index: state.index - 1,
        histories: state.histories
      };
    }),
  popHistory: (index) =>
    set((state) => ({
      index: state.index - 1,
      histories: state.histories.filter((_, i) => i !== index)
    })),
  // Drop `count` entries sitting directly below the current top, keeping the
  // top itself. Used by pop(n) to remove the screens it skips over in the same
  // synchronous block that starts the transition — so they never paint — while
  // the leaving top stays mounted to drive and resolve the animation.
  popHistories: (count) => {
    if (count <= 0) return;
    set((state) => {
      const top = state.index;
      return {
        index: state.index - count,
        histories: state.histories.filter((_, i) => i < top - count || i >= top)
      };
    });
  },
  // Override one entry's transition. Used by pop() to relabel the leaving top
  // before the POPPING flip so the back animation uses the caller's
  // `transitionName` from the first frame — its original transition never
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

export default useHistoryStore;
