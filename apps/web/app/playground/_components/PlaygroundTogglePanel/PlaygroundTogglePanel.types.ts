import type { PushTransitionOverride } from "@/app/playground/_stores/usePlaygroundSettingsStore";

export type TransitionGroupKind = "Built-in" | "Custom" | "Custom + decorator";

export interface TransitionOption {
  value: PushTransitionOverride;
  label: string;
  group: TransitionGroupKind;
  summary: string;
  code: string;
}

export interface TransitionGroup {
  kind: TransitionGroupKind;
  caption: string;
  options: ReadonlyArray<TransitionOption>;
}
