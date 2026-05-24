export type FeatureIconKind = "phone" | "swipe" | "code" | "layers" | "sparkle" | "palette";

export interface FeatureItem {
  icon: FeatureIconKind;
  label: string;
  body: string;
}
