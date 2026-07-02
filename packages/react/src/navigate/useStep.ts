import { useContext, useEffect, useState } from "react";

import { appendParamsQuery, createStepController, readStepParams } from "@flemo/core";

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

// A step is a sub-state pushed onto history without stacking a new screen (a
// param change). The push/replace/pop orchestration through the task queue is
// @flemo/core's createStepController; this hook is the React binding that
// wires the route / type surface around it.
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
  const buildStepPathname = (params: object) =>
    routePath
      ? buildRoutePath(routePath, params as RegisterRoute[keyof RegisterRoute]).pathname
      : appendParamsQuery(driver.readPathname(), params);

  // Surface the params: a screen dispatches to its ParamsProvider (unchanged);
  // chrome, which has no provider and gets no popstate from a push, sets `step`.
  const applyParams = (params: object) => {
    dispatch({ type: "SET", params });

    if (!routePath) setStep(params as StepParams<T>);
  };

  const controller = createStepController({
    stores,
    driver,
    markSelfInduced,
    buildStepPathname,
    applyParams
  });

  return {
    step,
    pushStep: (params: StepParams<T>) => controller.pushStep(params as object),
    replaceStep: (params: StepParams<T>) => controller.replaceStep(params as object),
    popStep: controller.popStep
  };
}
