"use client";

import { useNavigate } from "@flemo/react";

import type { Track } from "@/app/playground/_data/albums";
import usePlayerStore from "@/app/playground/_stores/usePlayerStore";
import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";
import resolvePushTransition from "@/app/playground/_utils/resolvePushTransition";

export interface TrackRowProps {
  index: number;
  track: Track;
}

function TrackRow({ index, track }: TrackRowProps) {
  const navigate = useNavigate();
  const setTrack = usePlayerStore((state) => state.setTrack);
  const pushTransition = usePlaygroundSettingsStore((state) => state.pushTransition);

  const handlePlay = () => {
    setTrack(track);
    navigate.push("/now-playing", undefined, {
      transitionName: resolvePushTransition(pushTransition, "/now-playing")
    });
  };

  return (
    <li>
      <button
        type="button"
        onClick={handlePlay}
        className="flex w-full items-center gap-4 py-2.5 text-left"
      >
        <span className="w-6 shrink-0 text-[13px] tabular-nums text-[var(--color-ink-mute)]">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--color-text-primary)]">
          {track.title}
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-[var(--color-ink-mute)]">
          {track.duration}
        </span>
      </button>
    </li>
  );
}

export default TrackRow;
