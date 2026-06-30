import { type PropsWithChildren, useEffect, useReducer } from "react";

import { TaskManger as TaskManager } from "@flemo/core";

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
    // (nested / multi-Router) and a memory Router works too. A useStep entry
    // carries its params inside the frame; on a back/forward onto a step entry,
    // restore them so the active screen reflects the step it landed on.
    return driver.subscribe((event) => {
      const frame = event.state as { step?: boolean; params?: object } | null;

      if (!frame?.step) return;

      TaskManager.addTask(async () => {
        dispatch({ type: "SET", params: frame.params ?? {} });
      });
    });
  }, [isActive, dispatch, driver]);

  return (
    <ParamsDispatchContext.Provider value={dispatch}>
      <ParamsContext.Provider value={value}>{children}</ParamsContext.Provider>
    </ParamsDispatchContext.Provider>
  );
}

export default ParamsProvider;
