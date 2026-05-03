import { useContext } from "react";

import TaskManager from "@core/TaskManger";

import useNavigationStore from "@navigate/store";

import useScreen from "@screen/useScreen";

import buildRoutePath from "@utils/buildRoutePath";

import ScreenParamsDispatchContext from "@screen/ParamsProvider/ParamsDispatchContext";

import type { RegisterRoute } from "@Route";

export default function useStep<T extends keyof RegisterRoute>() {
  const { routePath } = useScreen();

  const dispatch = useContext(ScreenParamsDispatchContext);

  const pushStep = async (params: RegisterRoute[T]) => {
    const status = useNavigationStore.getState().status;

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    (
      await TaskManager.addTask(async () => {
        const { pathname } = buildRoutePath(routePath, params);

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
    const status = useNavigationStore.getState().status;

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    (
      await TaskManager.addTask(async () => {
        const { pathname } = buildRoutePath(routePath, params);

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
    const status = useNavigationStore.getState().status;

    if (status !== "COMPLETED" && status !== "IDLE") {
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
