import type { PushTransition } from "@/app/playground/_stores/usePlaygroundSettingsStore";

export type TransitionGroupKind = "Default" | "Built-in" | "Custom";

export interface TransitionOption {
  value: PushTransition;
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
