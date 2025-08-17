import { useContext } from "react";

import taskManager from "@core/TaskManger";

import ScreenParamsDispatchContext from "@screen/ParamsProvider/ParamsDispatchContext";

import type { RegisterRoute } from "@Route";

export default function useStep<T extends keyof RegisterRoute>() {
  const dispatch = useContext(ScreenParamsDispatchContext);

  const pushStep = async (params: RegisterRoute[T]) => {
    if (taskManager.getManualPendingTasks().length) {
      return;
    }

    (
      await taskManager.addTask(async () => {
        const search = new URLSearchParams(params as Record<string, string>).toString();
        const pathname = `${window.location.pathname}${search ? `?${search}` : ""}`;

        if (!window.history.state?.step) {
          window.history.replaceState(
            {
              ...window.history.state,
              step: true
            },
            "",
            window.location.pathname
          );
        }

        window.history.pushState(
          {
            ...window.history.state,
            step: true,
            params
          },
          "",
          pathname
        );

        return async () => dispatch({ type: "SET", params });
      })
    ).result?.();
  };

  const replaceStep = async (params: RegisterRoute[T]) => {
    if (taskManager.getManualPendingTasks().length) {
      return;
    }

    (
      await taskManager.addTask(async () => {
        const search = new URLSearchParams(params as Record<string, string>).toString();
        const pathname = `${window.location.pathname}${search ? `?${search}` : ""}`;

        window.history.replaceState(
          {
            ...window.history.state,
            step: true,
            params
          },
          "",
          pathname
        );

        return async () => dispatch({ type: "SET", params });
      })
    ).result?.();
  };

  const popStep = () => {
    if (taskManager.getManualPendingTasks().length) {
      return;
    }

    window.history.back();
  };

  return {
    pushStep,
    replaceStep,
    popStep
  };
}
