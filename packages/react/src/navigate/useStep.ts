import { useContext, useEffect, useState } from "react";

import { TaskManger as TaskManager } from "@flemo/core";

import useScreen from "@screen/useScreen";

import buildRoutePath from "@utils/buildRoutePath";

import ScreenParamsDispatchContext from "@screen/ParamsProvider/ParamsDispatchContext";
import useStores from "@stores/useStores";

import type { RegisterRoute } from "@Route";

// The step's param shape. Pass a registered route to reuse its params from a
// screen (`useStep<"/posts/:id">()`), or pass the param object type directly for
// chrome rendered outside a <Screen> (`useStep<{ menu: boolean }>()`), so the
// header/sidebar overlay is typed too. Bare `useStep()` falls back to a free object.
type StepParams<T> = [T] extends [never]
  ? Record<string, unknown>
  : T extends keyof RegisterRoute
    ? RegisterRoute[T]
    : T;

// The current step's params from a history frame, or null when not on a step.
const readStepParams = <P>(state: unknown): P | null => {
  const frame = state as { step?: boolean; params?: object } | null;
  return frame?.step ? ((frame.params ?? {}) as P) : null;
};

// The current pathname plus the params as a query, so a chrome step reflects in
// the URL the same way a screen step does (`?code`), just on the current path
// since there is no route to build from.
const appendParamsQuery = (pathname: string, params: object): string => {
  const search = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))
  ).toString();
  return search ? `${pathname}?${search}` : pathname;
};

// A step is a sub-state pushed onto history without stacking a new screen (a
// param change). It goes through this Router's driver, not raw `window.history`:
// a keyed nested/multi-Router driver stores the frame under its `routerKey`, and
// the pop marks this Router's self-pop guard so its history sync skips it.
//
// Called from a <Screen>, the route's params drive the step URL and `useParams`
// reads them back (unchanged). Called from chrome OUTSIDE a <Screen> (a header
// menu), there is no route and no ParamsProvider, so the step keeps the current
// pathname and `step` reports its params reactively, read only after mount —
// chrome overlays start closed (the server can't know an open menu), so there is
// no hydration mismatch. Everything chrome-specific is gated on `!routePath`, so
// the screen path is byte-for-byte the original behavior.
export default function useStep<T extends keyof RegisterRoute | object = never>() {
  const { routePath } = useScreen();

  const stores = useStores();

  const dispatch = useContext(ScreenParamsDispatchContext);

  const { driver, markSelfInduced } = stores;

  // Chrome's reactive read of the current step. Inert for a screen: the effect
  // returns immediately when there is a routePath (the screen reads useParams),
  // so `step` stays null and nothing subscribes.
  const [step, setStep] = useState<StepParams<T> | null>(null);

  useEffect(() => {
    if (routePath) return;

    setStep(readStepParams<StepParams<T>>(driver.readState()));

    return driver.subscribe((event) => setStep(readStepParams<StepParams<T>>(event.state)));
  }, [routePath, driver]);

  // A screen builds the step URL from its route (unchanged); chrome appends the
  // params as a query on the current pathname.
  const stepPathname = (params: object) =>
    routePath
      ? buildRoutePath(routePath, params as RegisterRoute[keyof RegisterRoute]).pathname
      : appendParamsQuery(driver.readPathname(), params);

  // Surface the params: a screen dispatches to its ParamsProvider (unchanged);
  // chrome, which has no provider and gets no popstate from a push, sets `step`.
  const apply = (params: object) => {
    dispatch({ type: "SET", params });

    if (!routePath) setStep(params as StepParams<T>);
  };

  const pushStep = async (params: StepParams<T>) => {
    (
      await TaskManager.addTask(async () => {
        const pathname = stepPathname(params);

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

        return async () => apply(params);
      })
    ).result?.();
  };

  const replaceStep = async (params: StepParams<T>) => {
    (
      await TaskManager.addTask(async () => {
        const pathname = stepPathname(params);

        driver.replaceState(
          { ...(driver.readState() as object | null), step: true, params },
          pathname
        );

        return async () => apply(params);
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
            apply(nextState.params ?? {});
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
    step,
    pushStep,
    replaceStep,
    popStep
  };
}
