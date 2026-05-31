import type { PushTransitionOverride } from "@/app/playground/_stores/usePlaygroundSettingsStore";

export type TransitionGroupKind = "Built-in" | "Custom" | "Custom + decorator";

export interface TransitionOption {
  value: PushTransitionOverride;
  label: string;
  group: TransitionGroupKind;
  code: string;
}

export interface TransitionGroup {
  kind: TransitionGroupKind;
  options: ReadonlyArray<TransitionOption>;
}
