"use client";

import { albums } from "@/app/playground/_data/albums";
import usePlayerStore from "@/app/playground/_stores/usePlayerStore";

const VISIBLE_TRACK_COUNT = 14;

function LibrarySongsList() {
  const setTrack = usePlayerStore((state) => state.setTrack);
  const allTracks = albums.flatMap((album) => album.tracks);

  return (
    <ul className="flex flex-col divide-y divide-[var(--color-line)]">
      {allTracks.slice(0, VISIBLE_TRACK_COUNT).map((track) => (
        <li key={track.id}>
          <button
            type="button"
            onClick={() => setTrack(track)}
            className="flex w-full items-center justify-between gap-3 py-3 text-left"
          >
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                {track.title}
              </div>
              <div className="truncate text-[12px] text-[var(--color-ink-soft)]">
                {track.albumId}
              </div>
            </div>
            <span className="shrink-0 text-[12px] text-[var(--color-ink-mute)]">
              {track.duration}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default LibrarySongsList;
