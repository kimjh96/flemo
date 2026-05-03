import { create } from "zustand";

export type NavigateStatus = "IDLE" | "PUSHING" | "REPLACING" | "POPPING" | "COMPLETED";

interface NavigateStore {
  status: NavigateStatus;
  setStatus: (status: NavigateStatus) => void;
}

const useNavigateStore = create<NavigateStore>((set) => ({
  status: "IDLE",
  setStatus: (status) => set({ status })
}));

export default useNavigateStore;
