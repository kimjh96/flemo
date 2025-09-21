import { type PropsWithChildren, useEffect, useReducer } from "react";

import TaskManager from "@core/TaskManger";

import ParamsContext from "@screen/ParamsProvider/ParamsContext";
import ParamsDispatchContext from "@screen/ParamsProvider/ParamsDispatchContext";
import ParamsReducer from "@screen/ParamsProvider/ParamsReducer";

import useScreen from "@screen/useScreen";

function ParamsProvider({ children }: PropsWithChildren) {
  const { isActive, params } = useScreen();
  const [value, dispatch] = useReducer(ParamsReducer, params);

  useEffect(() => {
    const handlePopState = async (e: PopStateEvent) => {
      if (e.state?.step) {
        await TaskManager.addTask(async () => {
          dispatch({ type: "SET", params: e.state?.params || {} });
        });
      }
    };

    if (isActive) {
      window.addEventListener("popstate", handlePopState);
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isActive, dispatch]);

  return (
    <ParamsDispatchContext.Provider value={dispatch}>
      <ParamsContext.Provider value={value}>{children}</ParamsContext.Provider>
    </ParamsDispatchContext.Provider>
  );
}

export default ParamsProvider;
