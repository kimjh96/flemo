"use client";

import type { Track } from "@/app/playground/_data/albums";

export interface LibrarySongRowProps {
  track: Track;
  onSelect: (track: Track) => void;
}

function LibrarySongRow({ track, onSelect }: LibrarySongRowProps) {
  const handleSelect = () => onSelect(track);

  return (
    <li>
      <button
        type="button"
        onClick={handleSelect}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
            {track.title}
          </div>
          <div className="truncate text-[12px] text-[var(--color-ink-soft)]">{track.albumId}</div>
        </div>
        <span className="shrink-0 text-[12px] text-[var(--color-ink-mute)]">{track.duration}</span>
      </button>
    </li>
  );
}

export default LibrarySongRow;
