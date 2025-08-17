import { create } from "zustand";

import type { TransitionName } from "@transition/typing";

interface TransitionStore {
  defaultTransitionName: TransitionName;
  setDefaultTransitionName: (defaultTransitionName: TransitionName) => void;
}

const useTransitionStore = create<TransitionStore>((set) => ({
  defaultTransitionName: "cupertino",
  setDefaultTransitionName: (defaultTransitionName) => set({ defaultTransitionName })
}));

export default useTransitionStore;
