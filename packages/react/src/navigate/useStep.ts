import { useContext } from "react";

import { TaskManger as TaskManager } from "@flemo/core";

import useScreen from "@screen/useScreen";

import buildRoutePath from "@utils/buildRoutePath";

import ScreenParamsDispatchContext from "@screen/ParamsProvider/ParamsDispatchContext";
import useStores from "@stores/useStores";

import type { RegisterRoute } from "@Route";

// A step is a sub-state of the current screen (a param change that pushes a
// history entry without stacking a new screen). It goes through this Router's
// driver, not raw `window.history`, for two reasons: a keyed (nested or
// multi-Router) browser driver stores the frame under its `routerKey`, so the
// step flag + params must live inside that frame to survive a back; and the pop
// must mark this Router's OWN self-pop guard so its history sync skips the
// traversal instead of also handling it.
export default function useStep<T extends keyof RegisterRoute>() {
  const { routePath } = useScreen();

  const stores = useStores();

  const dispatch = useContext(ScreenParamsDispatchContext);

  const { driver, markSelfInduced } = stores;

  const pushStep = async (params: RegisterRoute[T]) => {
    (
      await TaskManager.addTask(async () => {
        const { pathname } = buildRoutePath(routePath, params);

        // Mark the current frame as a step boundary, preserving its params, so a
        // later popStep back onto it restores that screen's params instead of an
        // empty object.
        const current = driver.readState() as { step?: boolean } | null;

        if (!current?.step) {
          driver.replaceState({ ...current, step: true }, window.location.pathname);
        }

        driver.pushState(
          { ...(driver.readState() as object | null), step: true, params },
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

        driver.replaceState(
          { ...(driver.readState() as object | null), step: true, params },
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
          // Capture the traversal inline so any step-dispatch or screen-pop work
          // happens *within this task*. Letting the listener enqueue a separate
          // task would put it behind whatever the caller queued after popStep(),
          // breaking call order.
          type NextState = { step?: boolean; params?: object } | null;

          // Wait on the driver's own traversal event: the keyed frame is already
          // extracted (state[routerKey]) and a memory Router fires it too.
          const popstateFired = new Promise<NextState>((resolve) => {
            const dispose = driver.subscribe((event) => {
              dispose();
              resolve(event.state as NextState);
            });
          });

          // Safety timeout. back() should always produce a traversal when there's
          // something to go back to; this prevents a queue hang.
          const safetyTimeout = new Promise<undefined>((resolve) =>
            setTimeout(() => resolve(undefined), 200)
          );

          // Mark THIS Router's guard so its history sync skips the traversal.
          markSelfInduced();
          driver.back();

          const nextState = await Promise.race<NextState | undefined>([
            popstateFired,
            safetyTimeout
          ]);

          if (!nextState) {
            abortController.abort();
            return;
          }

          if (nextState.step) {
            // Step pop. Apply params right here.
            dispatch({ type: "SET", params: nextState.params ?? {} });
            abortController.abort();
            return;
          }

          // Crossed the step boundary into a screen pop. Same pattern as
          // `pop()`: setStatus + transitionTaskId, animation completes, then
          // the returned completion fn pops the history entry.
          const { setStatus, setTransitionTaskId } = stores.navigate.getState();
          const { index, popHistory } = stores.history.getState();

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
