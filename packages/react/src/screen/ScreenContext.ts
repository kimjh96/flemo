import { createContext } from "react";

import type { FlemoStores, History, TransitionName } from "@flemo/core";

import type { Path } from "path-to-regexp";

export interface ScreenContextProps extends History {
  id: string;
  isActive: boolean;
  isRoot: boolean;
  isPrev: boolean;
  zIndex: number;
  prevTransitionName: TransitionName;
  routePath: Path;
  // The navigate store of the Router that OWNS this screen. Screen-scoped
  // consumers (e.g. <Part>) must read their screen's status from here rather
  // than the nearest StoreContext: inside a nested <Router>'s chrome the
  // nearest bundle is the inner Router's, while the enclosing screen still
  // belongs to the outer one. Absent outside any screen.
  navigateStore?: FlemoStores["navigate"];
}

const ScreenContext = createContext<ScreenContextProps>({
  id: "",
  isActive: false,
  isRoot: true,
  isPrev: false,
  zIndex: 0,
  pathname: "",
  params: {},
  transitionName: "none",
  prevTransitionName: "none",
  layoutId: null,
  routePath: ""
});

export default ScreenContext;
