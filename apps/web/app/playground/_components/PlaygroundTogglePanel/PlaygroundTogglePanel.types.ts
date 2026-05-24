import type { PushTransition } from "@/app/playground/_stores/usePlaygroundSettingsStore";

export type TransitionSource = "Built-in" | "Custom";

export interface TransitionOption {
  value: PushTransition;
  label: string;
  source: TransitionSource;
  summary: string;
  code: string;
}
