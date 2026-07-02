import TaskManager from "@core/TaskManger";

import type { HistoryDriver } from "@history/historyDriver";
import type { HistoryStoreApi } from "@history/store";

import type { NavigateStoreApi } from "@navigate/store";

// The current step's params from a history frame, or null when not on a step.
export const readStepParams = <P>(state: unknown): P | null => {
  const frame = state as { step?: boolean; params?: object } | null;
  return frame?.step ? ((frame.params ?? {}) as P) : null;
};

// The current pathname plus the params as a query, so a chrome step reflects in
// the URL the same way a screen step does (`?code`), just on the current path
// since there is no route to build from.
export const appendParamsQuery = (pathname: string, params: object): string => {
  const search = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))
  ).toString();
  return search ? `${pathname}?${search}` : pathname;
};

export interface StepControllerDeps {
  // The request-scoped stores (framework-neutral zustand vanilla stores).
  stores: {
    history: HistoryStoreApi;
    navigate: NavigateStoreApi;
  };
  // The history backend for this Router scope. A step goes through the driver,
  // not raw `window.history`: a keyed nested/multi-Router driver stores the
  // frame under its `routerKey`, and a memory Router works unchanged.
  driver: HistoryDriver;
  // Marks a flemo-induced traversal so this Router's history sync skips it.
  markSelfInduced: () => void;
  // Builds the step's URL from its params. The binding owns this: a screen
  // compiles its route pattern, chrome appends the params as a query on the
  // current pathname (see `appendParamsQuery`).
  buildStepPathname: (params: object) => string;
  // Surfaces the applied params back to the binding: a screen dispatches to its
  // params provider, chrome sets its reactive step state.
  applyParams: (params: object) => void;
}

// A step is a sub-state pushed onto history without stacking a new screen (a
// param change). Framework-neutral orchestration of push/replace/pop through
// the task queue; the binding wires the route/type surface and the reactive
// reads around it.
export default function createStepController(deps: StepControllerDeps) {
  const { stores, driver, markSelfInduced, buildStepPathname, applyParams } = deps;

  const pushStep = async (params: object) => {
    (
      await TaskManager.addTask(async () => {
        const pathname = buildStepPathname(params);

        // Mark the current frame as a step boundary, preserving its params, so a
        // later popStep back onto it restores that frame's params instead of an
        // empty object.
        const current = driver.readState() as { step?: boolean } | null;

        if (!current?.step) {
          // Read the current path THROUGH the driver (a wrapping driver's URL
          // mapping round-trips); never `window.location` directly.
          driver.replaceState({ ...current, step: true }, driver.readPathname());
        }

        driver.pushState(
          { ...(driver.readState() as object | null), step: true, params },
          pathname
        );

        return async () => applyParams(params);
      })
    ).result?.();
  };

  const replaceStep = async (params: object) => {
    (
      await TaskManager.addTask(async () => {
        const pathname = buildStepPathname(params);

        driver.replaceState(
          { ...(driver.readState() as object | null), step: true, params },
          pathname
        );

        return async () => applyParams(params);
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
            // Step pop. Apply the boundary params right here.
            applyParams(nextState.params ?? {});
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

// Restores step params when a browser back/forward lands on a step frame: the
// binding's params provider subscribes with this so the active screen reflects
// the step it landed on. The apply runs through the task queue, ordered behind
// whatever navigation work is already in flight.
export function subscribeStepParamsRestore(
  driver: HistoryDriver,
  onParams: (params: object) => void
): () => void {
  return driver.subscribe((event) => {
    const frame = event.state as { step?: boolean; params?: object } | null;

    if (!frame?.step) return;

    TaskManager.addTask(async () => {
      onParams(frame.params ?? {});
    });
  });
}
