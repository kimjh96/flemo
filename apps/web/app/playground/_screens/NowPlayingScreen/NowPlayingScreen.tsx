"use client";

import { useParams, useStep } from "@flemo/react";

import { albumById } from "@/app/playground/_data/albums";
import { PlayerScreen } from "@/app/playground/_screens/PlayerScreen";
import usePlayerStore from "@/app/playground/_stores/usePlayerStore";

import NowPlayingArtwork from "./NowPlayingArtwork";
import NowPlayingControls from "./NowPlayingControls";
import NowPlayingHeader from "./NowPlayingHeader";
import NowPlayingProgress from "./NowPlayingProgress";
import { tintBackgroundForHue } from "./NowPlayingScreen.utils";
import NowPlayingTabs from "./NowPlayingTabs";

import type { NowPlayingStepParams, NowPlayingTab } from "./NowPlayingScreen.types";

const ELAPSED_PLACEHOLDER = "1:08";
const PROGRESS_PLACEHOLDER = 1 / 3;

function NowPlayingScreen() {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const params = useParams<"/now-playing">();
  const { pushStep, popStep } = useStep<"/now-playing">();

  const album = albumById(currentTrack.albumId);
  if (!album) return null;

  const tab: NowPlayingTab = params?.tab ?? "player";
  const expanded = params?.expanded === true;

  return (
    <PlayerScreen>
      <div
        className="flex h-full w-full flex-col px-5 pb-8 pt-3"
        style={{ background: tintBackgroundForHue(album.hue) }}
      >
        <NowPlayingHeader />

        <NowPlayingTabs tab={tab} />

        <div
          className="mt-4 flex flex-1 flex-col items-center justify-center gap-6"
          data-flemo-step-pane={tab}
        >
          {tab === "player" && (
            <>
              <NowPlayingArtwork hue={album.hue} title={currentTrack.title} artist={album.artist} />
              <NowPlayingProgress
                elapsed={ELAPSED_PLACEHOLDER}
                remaining={currentTrack.duration}
                progress={PROGRESS_PLACEHOLDER}
              />
              <NowPlayingControls />
              {!expanded && (
                <button
                  type="button"
                  onClick={() => pushStep({ tab: "player", expanded: true })}
                  data-flemo-step-action="expand"
                  className="rounded-full border border-[var(--color-text-primary)]/15 px-3 py-1 text-[12px] font-semibold text-[var(--color-text-primary)]/70"
                >
                  Show album details
                </button>
              )}
              {expanded && (
                <div
                  data-flemo-step-pane-detail="player-expanded"
                  className="w-full rounded-2xl border border-[var(--color-text-primary)]/15 bg-[var(--color-text-primary)]/5 p-4"
                >
                  <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {album.title}
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--color-ink-soft)]">
                    {album.artist} · {album.year} · {album.tracks.length} tracks
                  </div>
                  <button
                    type="button"
                    onClick={() => popStep()}
                    data-flemo-step-action="collapse"
                    className="mt-3 rounded-full bg-[var(--color-text-primary)] px-3 py-1 text-[12px] font-semibold text-[var(--color-bg)]"
                  >
                    Close details
                  </button>
                </div>
              )}
            </>
          )}

          {tab === "queue" && (
            <div className="w-full">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-mute)]">
                Up Next
              </div>
              <ul className="mt-2 flex flex-col divide-y divide-[var(--color-text-primary)]/10">
                {album.tracks.slice(0, 5).map((track) => (
                  <li
                    key={track.id}
                    className="flex items-center justify-between py-2 text-[13px] text-[var(--color-text-primary)]"
                  >
                    <span className="truncate">{track.title}</span>
                    <span className="tabular-nums text-[var(--color-ink-mute)]">
                      {track.duration}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "lyrics" && (
            <div className="w-full text-center text-[13px] leading-relaxed text-[var(--color-text-primary)]/80">
              <p>Lyrics unavailable in the demo.</p>
              <p className="mt-2 text-[var(--color-ink-mute)]">
                This pane exists so the useStep `replaceStep` API can be exercised.
              </p>
            </div>
          )}
        </div>
      </div>
    </PlayerScreen>
  );
}

export default NowPlayingScreen;

declare module "@flemo/react" {
  interface RegisterRoute {
    "/now-playing": NowPlayingStepParams;
  }
}
