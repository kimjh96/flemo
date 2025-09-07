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
    }))
}));

export default useHistoryStore;
