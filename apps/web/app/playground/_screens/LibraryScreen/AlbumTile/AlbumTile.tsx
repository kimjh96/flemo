"use client";

import { useNavigate } from "@flemo/react";

import type { Album } from "@/app/playground/_data/albums";
import { gradientFor } from "@/app/playground/_data/gradient";
import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

export interface AlbumTileProps {
  album: Album;
}

function AlbumTile({ album }: AlbumTileProps) {
  const navigate = useNavigate();
  const pushTransitionOverride = usePlaygroundSettingsStore(
    (state) => state.pushTransitionOverride
  );

  const handleOpen = () => {
    navigate.push(
      "/album/:id",
      { id: album.id },
      // Browse-deeper hop. Cupertino fits naturally. The override is for
      // playground experimentation only.
      { transitionName: pushTransitionOverride ?? "cupertino" }
    );
  };

  return (
    <button type="button" onClick={handleOpen} className="flex w-full flex-col gap-2 text-left">
      <div
        className="aspect-square w-full rounded-xl"
        style={{ background: gradientFor(album.hue) }}
      />
      <div className="px-0.5">
        <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {album.title}
        </div>
        <div className="truncate text-xs text-[var(--color-ink-soft)]">{album.artist}</div>
      </div>
    </button>
  );
}

export default AlbumTile;
