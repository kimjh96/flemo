// React layer
export { default as Router } from "@Router";
export { default as Route, type RegisterRoute } from "@Route";
export { default as useNavigate } from "@navigate/useNavigate";
export { default as useStep } from "@navigate/useStep";
export { default as useScreen } from "@screen/useScreen";
export { default as useParams } from "@screen/ParamsProvider/useParams";
export { default as Screen, type ScreenProps } from "@screen/Screen";
export { default as LayoutScreen } from "@screen/LayoutScreen";
export { default as LayoutConfig } from "@screen/LayoutConfig";
export { default as useViewportScrollHeight } from "@screen/useViewportScrollHeight";

// Framework-agnostic primitives re-exported so users importing from
// "@flemo/react" (or the meta `flemo` package) still get the full API.
export {
  createTransition,
  createRawTransition,
  createDecorator,
  createRawDecorator
} from "@flemo/core";

export type {
  TransitionName,
  RegisterTransition,
  DecoratorName,
  RegisterDecorator
} from "@flemo/core";
