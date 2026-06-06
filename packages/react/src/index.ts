// React layer
export { default as Router } from "@Router";
export { default as Route, type RegisterRoute } from "@Route";
export { default as useNavigate } from "@navigate/useNavigate";
export { default as useStep } from "@navigate/useStep";
export { default as useScreen } from "@screen/useScreen";
export { default as useParams } from "@screen/ParamsProvider/useParams";
export { default as Screen, type ScreenProps } from "@screen/Screen";
export { default as ScreenMotion } from "@screen/ScreenMotion";
export { default as ScreenFreeze } from "@screen/ScreenFreeze";
export { default as ScreenDecorator } from "@screen/ScreenDecorator";
export { default as ScreenContext, type ScreenContextProps } from "@screen/ScreenContext";
export { default as useHistoryStore } from "@stores/useHistoryStore";
export { default as useNavigateStore } from "@stores/useNavigateStore";
export { default as useTransitionStore } from "@stores/useTransitionStore";
export { default as useScreenStore } from "@stores/useScreenStore";
export { default as useStores } from "@stores/useStores";
export { default as FlemoStoreProvider } from "@stores/StoreProvider";
export { type FlemoStores } from "@stores/StoreContext";
export { type SharedBarPresence } from "@screen/store";
export { default as useViewportScrollHeight } from "@screen/useViewportScrollHeight";

// Framework-agnostic primitives re-exported so users importing from
// "@flemo/react" still get the full transition/decorator API in one place.
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
