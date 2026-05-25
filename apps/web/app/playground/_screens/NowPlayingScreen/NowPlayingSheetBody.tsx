"use client";

import type { Album } from "@/app/playground/_data/albums";

import type { NowPlayingSheet } from "./NowPlayingScreen.types";

export interface NowPlayingSheetBodyProps {
  sheet: NowPlayingSheet | null;
  album: Album;
}

function NowPlayingSheetBody({ sheet, album }: NowPlayingSheetBodyProps) {
  if (sheet === "queue") {
    return (
      <ul
        data-flemo-step-pane="queue"
        className="flex flex-col divide-y divide-[var(--color-text-primary)]/10"
      >
        {album.tracks.slice(0, 5).map((track) => (
          <li
            key={track.id}
            className="flex items-center justify-between py-2 text-[13px] text-[var(--color-text-primary)]"
          >
            <span className="truncate">{track.title}</span>
            <span className="tabular-nums text-[var(--color-ink-mute)]">{track.duration}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (sheet === "lyrics") {
    return (
      <div
        data-flemo-step-pane="lyrics"
        className="text-center text-[13px] leading-relaxed text-[var(--color-text-primary)]/80"
      >
        <p>Lyrics unavailable in the demo.</p>
        <p className="mt-2 text-[var(--color-ink-mute)]">
          Tap the chip above to swap the sheet contents in place via `replaceStep` — no close /
          reopen.
        </p>
      </div>
    );
  }
  return null;
}

export default NowPlayingSheetBody;
