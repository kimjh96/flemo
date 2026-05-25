"use client";

import { useNavigate } from "@flemo/react";

import type { Album } from "@/app/playground/_data/albums";
import { gradientFor } from "@/app/playground/_data/gradient";
import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";
import resolvePushTransition from "@/app/playground/_utils/resolvePushTransition";

export interface SearchAlbumRowProps {
  album: Album;
}

function SearchAlbumRow({ album }: SearchAlbumRowProps) {
  const navigate = useNavigate();
  const pushTransition = usePlaygroundSettingsStore((state) => state.pushTransition);

  const handleOpen = () => {
    navigate.push(
      "/album/:id",
      { id: album.id },
      { transitionName: resolvePushTransition(pushTransition, "/album/:id") }
    );
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex w-full items-center gap-3 py-2 text-left"
    >
      <div
        className="h-12 w-12 shrink-0 rounded-md"
        style={{ background: gradientFor(album.hue) }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
          {album.title}
        </div>
        <div className="truncate text-[12px] text-[var(--color-ink-soft)]">
          Album · {album.artist}
        </div>
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="shrink-0 text-[var(--color-ink-mute)]"
      >
        <path
          d="M6 4l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </button>
  );
}

export default SearchAlbumRow;
