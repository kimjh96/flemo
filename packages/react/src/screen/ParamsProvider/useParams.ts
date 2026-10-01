import { useContext } from "react";

import ScreenParamsContext from "@screen/ParamsProvider/ParamsContext";

import type { RegisterRoute } from "@Route";

/**
 * The enclosing screen's route params, typed by a registered route:
 * `useParams<"/posts/:id">()`.
 *
 * Params come from the navigation that mounted the screen, and a `useStep`
 * push updates them in place without stacking a new screen.
 */
export default function useParams<T extends keyof RegisterRoute>() {
  return useContext(ScreenParamsContext) as RegisterRoute[T];
}
