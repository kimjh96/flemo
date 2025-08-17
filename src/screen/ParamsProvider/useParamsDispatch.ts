import { useContext } from "react";

import ScreenParamsDispatchContext from "@screen/ParamsProvider/ParamsDispatchContext";

export default function useParamsDispatch() {
  return useContext(ScreenParamsDispatchContext);
}
