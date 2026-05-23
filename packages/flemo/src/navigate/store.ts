import { create } from "zustand";

export type NavigateStatus = "IDLE" | "PUSHING" | "REPLACING" | "POPPING" | "COMPLETED";

interface NavigateStore {
  status: NavigateStatus;
  transitionTaskId: string | null;
  setStatus: (status: NavigateStatus) => void;
  setTransitionTaskId: (transitionTaskId: string | null) => void;
}

const useNavigateStore = create<NavigateStore>((set) => ({
  status: "IDLE",
  transitionTaskId: null,
  setStatus: (status) => set({ status }),
  setTransitionTaskId: (transitionTaskId) => set({ transitionTaskId })
}));

export default useNavigateStore;
