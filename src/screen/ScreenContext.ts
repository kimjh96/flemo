import { createContext } from "react";

import type { History } from "@history/store";
import type { TransitionName } from "@transition/typing";

export interface ScreenContextProps extends History {
  id: string;
  isActive: boolean;
  isRoot: boolean;
  isPrev: boolean;
  zIndex: number;
  prevTransitionName: TransitionName;
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
  layoutId: null
});

export default ScreenContext;
