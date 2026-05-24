import { createContext } from "react";

import type { History, TransitionName } from "@flemo/core";

import type { Path } from "path-to-regexp";

export interface ScreenContextProps extends History {
  id: string;
  isActive: boolean;
  isRoot: boolean;
  isPrev: boolean;
  zIndex: number;
  prevTransitionName: TransitionName;
  routePath: Path;
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
