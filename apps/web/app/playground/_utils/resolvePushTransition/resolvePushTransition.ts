import type { PushTransition } from "@/app/playground/_stores/usePlaygroundSettingsStore";

export type PushTarget = "/album/:id" | "/now-playing";
export type ResolvedTransition = Exclude<PushTransition, "harmonized">;

export default function resolvePushTransition(
  setting: PushTransition,
  target: PushTarget
): ResolvedTransition {
  if (setting !== "harmonized") return setting;
  // The player closes with a downward chevron — match it with a vertical
  // rise so the in/out gesture maps to the close affordance. Everything
  // else is a "browse deeper" hop, so cupertino's horizontal push fits.
  return target === "/now-playing" ? "material" : "cupertino";
}
