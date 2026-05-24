"use client";

import { useNavigate, useParams } from "@flemo/react";

import PlayerBottomBar from "@/app/playground/_components/PlayerBottomBar";
import { albumById } from "@/app/playground/_data/albums";
import { gradientFor } from "@/app/playground/_data/gradient";
import { PlayerScreen } from "@/app/playground/_screens/PlayerScreen";
import usePlayerStore from "@/app/playground/_stores/usePlayerStore";
import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import AlbumAppBar from "./AlbumAppBar";
import TrackRow from "./TrackRow";

function AlbumScreen() {
  const params = useParams<"/album/:id">();
  const navigate = useNavigate();
  const setTrack = usePlayerStore((state) => state.setTrack);
  const showMiniPlayer = usePlaygroundSettingsStore((state) => state.showMiniPlayer);
  const pushTransition = usePlaygroundSettingsStore((state) => state.pushTransition);

  const album = params ? albumById(params.id) : undefined;

  if (!album) {
    return (
      <PlayerScreen appBar={<AlbumAppBar title="Album" />}>
        <div className="grid h-full place-items-center bg-[var(--color-surface)] text-[14px] text-[var(--color-ink-mute)]">
          Album not found
        </div>
      </PlayerScreen>
    );
  }

  const handleOpenNowPlaying = () => {
    const firstTrack = album.tracks[0];
    if (!firstTrack) return;
    setTrack(firstTrack);
    navigate.push("/now-playing", undefined, { transitionName: pushTransition });
  };

  return (
    <PlayerScreen
      appBar={<AlbumAppBar title={album.title} />}
      sharedNavigationBar={showMiniPlayer ? <PlayerBottomBar activePath="/" /> : undefined}
    >
      <div className="flex min-h-full w-full flex-col gap-6 bg-[var(--color-surface)] px-5 pb-8 pt-3">
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleOpenNowPlaying}
            className="h-48 w-48 cursor-pointer rounded-2xl shadow-[0_4px_24px_-8px_rgba(15,19,27,0.14)]"
            style={{ background: gradientFor(album.hue) }}
            aria-label={`Play ${album.title}`}
          />
          <div className="w-full">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">{album.title}</div>
            <div className="text-sm text-[var(--color-ink-soft)]">
              {album.artist} · {album.year}
            </div>
          </div>
        </div>

        <ol className="flex flex-col divide-y divide-[var(--color-line)]">
          {album.tracks.map((track, index) => (
            <TrackRow key={track.id} index={index} track={track} />
          ))}
        </ol>
      </div>
    </PlayerScreen>
  );
}

export default AlbumScreen;

declare module "@flemo/react" {
  interface RegisterRoute {
    "/album/:id": { id: string };
  }
}
