import { useContext } from "react";

import {
  markSelfInducedPop,
  TaskManger as TaskManager,
  useHistoryStore,
  useNavigateStore
} from "@flemo/core";

import useScreen from "@screen/useScreen";

import buildRoutePath from "@utils/buildRoutePath";

import ScreenParamsDispatchContext from "@screen/ParamsProvider/ParamsDispatchContext";

import type { RegisterRoute } from "@Route";

export default function useStep<T extends keyof RegisterRoute>() {
  const { routePath } = useScreen();

  const dispatch = useContext(ScreenParamsDispatchContext);

  const pushStep = async (params: RegisterRoute[T]) => {
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

  const popStep = async () => {
    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async (abortController) => {
          // Capture the popstate inline so any step-dispatch or screen-pop
          // work happens *within this task*. Letting popstate listeners enqueue
          // separate tasks would put them behind whatever the caller queued
          // after popStep(), breaking call order.
          type NextState = { step?: boolean; params?: object } | null;

          const popstateFired = new Promise<NextState>((resolve) => {
            window.addEventListener(
              "popstate",
              (e: PopStateEvent) => resolve(e.state as NextState),
              { once: true }
            );
          });

          // Safety timeout — back() should always produce a popstate when
          // there's something to go back to; this prevents a queue hang.
          const safetyTimeout = new Promise<undefined>((resolve) =>
            setTimeout(() => resolve(undefined), 200)
          );

          markSelfInducedPop();
          window.history.back();

          const nextState = await Promise.race<NextState | undefined>([
            popstateFired,
            safetyTimeout
          ]);

          if (!nextState) {
            abortController.abort();
            return;
          }

          if (nextState.step) {
            // Step pop — apply params right here.
            dispatch({ type: "SET", params: nextState.params ?? {} });
            abortController.abort();
            return;
          }

          // Crossed the step boundary into a screen pop. Same pattern as
          // `pop()`: setStatus + transitionTaskId, animation completes, then
          // the returned completion fn pops the history entry.
          const { setStatus, setTransitionTaskId } = useNavigateStore.getState();
          const { index, popHistory } = useHistoryStore.getState();

          setStatus("POPPING");
          setTransitionTaskId(id);

          return async () => {
            popHistory(index);
            setStatus("COMPLETED");
          };
        },
        {
          id,
          control: {
            manual: true
          }
        }
      )
    ).result?.();
  };

  return {
    pushStep,
    replaceStep,
    popStep
  };
}
