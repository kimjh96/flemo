// React layer
export { default as Router } from "@Router";
export { default as Route, type RegisterRoute } from "@Route";
export { default as Slot, type SlotProps } from "./Slot";
export { default as useNavigate, type UseNavigateOptions } from "@navigate/useNavigate";
export {
  type RegisterRouter,
  type RouterName,
  type RouterScopeKeyword,
  type RouterTarget
} from "./RouterTarget";
export { type RouterScopeNode } from "./RouterScopeContext";
export { default as usePathname } from "@navigate/usePathname";
export { default as useStep } from "@navigate/useStep";
export { default as useScreen } from "@screen/useScreen";
export { default as useParams } from "@screen/ParamsProvider/useParams";
export { default as Screen, type ScreenProps } from "@screen/Screen";
export { default as ScreenMotion } from "@screen/ScreenMotion";
export { default as ScreenFreeze } from "@screen/ScreenFreeze";
export { default as ScreenDecorator } from "@screen/ScreenDecorator";
export { default as Part, type PartProps } from "@screen/Part";
export { default as ScreenContext, type ScreenContextProps } from "@screen/ScreenContext";
export { default as useHistoryStore } from "@stores/useHistoryStore";
export { default as useNavigateStore } from "@stores/useNavigateStore";
export { default as useScreenStore } from "@stores/useScreenStore";
export { default as useStores } from "@stores/useStores";
export { default as RouterScopeProvider } from "@stores/RouterScopeProvider";
export { type FlemoStores } from "@stores/StoreContext";
export {
  type SharedBarId,
  type SharedBarMetadata,
  type SharedBarPresence,
  type SharedBarsMetadata
} from "@screen/store";
export { default as useViewportScrollHeight } from "@screen/useViewportScrollHeight";
export { default as useKeyboardInset } from "@screen/useKeyboardInset";

// Framework-agnostic primitives re-exported so users importing from
// "@flemo/react" still get the full transition/decorator API in one place.
export {
  createTransition,
  createRawTransition,
  createDecorator,
  createRawDecorator,
  createPartTransition,
  createRawPartTransition,
  partTransitionMap,
  createBrowserHistoryDriver
} from "@flemo/core";

export type {
  TransitionName,
  RegisterTransition,
  DecoratorName,
  RegisterDecorator,
  PartTransitionName,
  RegisterPartTransition,
  PartTransitionOptions,
  HistoryDriver,
  HistoryNavEvent
} from "@flemo/core";
