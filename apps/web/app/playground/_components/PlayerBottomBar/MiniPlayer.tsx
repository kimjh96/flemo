"use client";

import { useNavigate } from "@flemo/react";

import { albumById } from "@/app/playground/_data/albums";
import { gradientFor } from "@/app/playground/_data/gradient";
import usePlayerStore from "@/app/playground/_stores/usePlayerStore";
import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import PlayPauseIcon from "./PlayPauseIcon";

function MiniPlayer() {
  const navigate = useNavigate();
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const pushTransitionOverride = usePlaygroundSettingsStore(
    (state) => state.pushTransitionOverride
  );

  const album = albumById(currentTrack.albumId);
  if (!album) return null;

  const handleOpenNowPlaying = () => {
    navigate.push("/now-playing", undefined, {
      // Player open — match the close gesture's vertical axis with material.
      transitionName: pushTransitionOverride ?? "material"
    });
  };

  const handleTogglePlay = (event: React.MouseEvent) => {
    event.stopPropagation();
    togglePlay();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenNowPlaying();
    }
  };

  return (
    <div className="flex w-full items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5">
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpenNowPlaying}
        onKeyDown={handleKeyDown}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div
          className="h-10 w-10 shrink-0 rounded-lg"
          style={{ background: gradientFor(album.hue) }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {currentTrack.title}
          </div>
          <div className="truncate text-xs text-[var(--color-ink-soft)]">{album.artist}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-layer)]"
      >
        <PlayPauseIcon playing={isPlaying} />
      </button>
    </div>
  );
}

export default MiniPlayer;
