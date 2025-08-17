import type { Dispatch } from "react";
import { createContext } from "react";

export interface ParamsDispatchContextType {
  type: "SET";
  params: object;
}

const ParamsDispatchContext = createContext<Dispatch<ParamsDispatchContextType>>(() => {});

export default ParamsDispatchContext;
