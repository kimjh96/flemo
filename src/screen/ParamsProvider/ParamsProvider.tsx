import { type PropsWithChildren, useEffect, useReducer } from "react";

import TaskManager from "@core/TaskManger";

import ParamsContext from "@screen/ParamsProvider/ParamsContext";
import ParamsDispatchContext from "@screen/ParamsProvider/ParamsDispatchContext";
import ParamsReducer from "@screen/ParamsProvider/ParamsReducer";

function ParamsProvider({
  children,
  active,
  params
}: PropsWithChildren<{
  active: boolean;
  params: object;
}>) {
  const [value, dispatch] = useReducer(ParamsReducer, params);

  useEffect(() => {
    const handlePopState = async (e: PopStateEvent) => {
      if (e.state?.step) {
        await TaskManager.addTask(async () => {
          dispatch({ type: "SET", params: e.state?.params || {} });
        });
      }
    };

    if (active) {
      window.addEventListener("popstate", handlePopState);
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [active, dispatch]);

  return (
    <ParamsDispatchContext.Provider value={dispatch}>
      <ParamsContext.Provider value={value}>{children}</ParamsContext.Provider>
    </ParamsDispatchContext.Provider>
  );
}

export default ParamsProvider;
