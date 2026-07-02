import { type PropsWithChildren, useEffect, useReducer } from "react";

import { subscribeStepParamsRestore } from "@flemo/core";

import useScreen from "@screen/useScreen";

import ParamsContext from "@screen/ParamsProvider/ParamsContext";
import ParamsDispatchContext from "@screen/ParamsProvider/ParamsDispatchContext";
import ParamsReducer from "@screen/ParamsProvider/ParamsReducer";
import useStores from "@stores/useStores";

function ParamsProvider({ children }: PropsWithChildren) {
  const { isActive, params } = useScreen();
  const { driver } = useStores();
  const [value, dispatch] = useReducer(ParamsReducer, params);

  useEffect(() => {
    if (!isActive) return;

    // Subscribe through this Router's driver so the frame is keyed-extracted
    // (nested / multi-Router) and a memory Router works too. The step-frame
    // filtering + task-queued apply is @flemo/core's subscribeStepParamsRestore.
    return subscribeStepParamsRestore(driver, (params) => dispatch({ type: "SET", params }));
  }, [isActive, dispatch, driver]);

  return (
    <ParamsDispatchContext.Provider value={dispatch}>
      <ParamsContext.Provider value={value}>{children}</ParamsContext.Provider>
    </ParamsDispatchContext.Provider>
  );
}

export default ParamsProvider;
