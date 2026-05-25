export type NowPlayingTab = "player" | "queue" | "lyrics";

export interface NowPlayingStepParams {
  tab?: NowPlayingTab;
  expanded?: boolean;
}
