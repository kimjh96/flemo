import { useContext } from "react";

import ScreenParamsContext from "@screen/ParamsProvider/ParamsContext";

import type { RegisterRoute } from "@Route";

export default function useParams<T extends keyof RegisterRoute>() {
  return useContext(ScreenParamsContext) as RegisterRoute[T];
}
