"use client";

import { useNavigate } from "@flemo/react";

import { artworkFor, TRACKS } from "../../_data/tracks";

// The mini player. Library declares it as the shared bar; Now Playing does not,
// so flemo animates it away on the push and back on the pop (the shared-bar
// present/absent transition, shown here in a second context).
function MiniPlayer() {
  const navigate = useNavigate();
  const track = TRACKS[0]!;

  const handleOpen = () =>
    navigate.push("/music/playing/:id", { id: track.id }, { transitionName: "material" });

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex w-full cursor-pointer items-center gap-3 border-t border-[var(--color-border-light)] bg-[var(--color-bg)]/85 px-4 py-3 text-left backdrop-blur-xl"
    >
      <span
        className="size-10 shrink-0 rounded-lg"
        style={{ background: artworkFor(track.hue) }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {track.title}
        </span>
        <span className="block truncate text-xs text-[var(--color-text-disabled)]">
          {track.artist}
        </span>
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  );
}

export default MiniPlayer;
