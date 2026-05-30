"use client";

import { useNavigate, useParams } from "@flemo/react";

import PlayerBottomBar from "@/app/playground/_components/PlayerBottomBar";
import { albums } from "@/app/playground/_data/albums";
import { PlayerScreen } from "@/app/playground/_screens/PlayerScreen";
import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import AlbumTile from "./AlbumTile";
import LibraryArtistsList from "./LibraryArtistsList";
import LibraryHeader from "./LibraryHeader";
import LibrarySongsList from "./LibrarySongsList";
import { segmentIndex } from "./LibraryScreen.utils";

import type { Segment } from "./LibraryScreen.types";

function LibraryScreen() {
  const params = useParams<"/">();
  const navigate = useNavigate();
  const showMiniPlayer = usePlaygroundSettingsStore((state) => state.showMiniPlayer);
  const showSharedAppBar = usePlaygroundSettingsStore((state) => state.showSharedAppBar);
  const segment: Segment = params?.segment ?? "albums";

  const handleSegmentChange = (next: Segment) => {
    if (next === segment) return;
    const transitionName =
      segmentIndex(next) > segmentIndex(segment) ? "slide-left" : "slide-right";
    navigate.replace("/", { segment: next }, { transitionName });
  };

  return (
    <PlayerScreen
      // Title + segment bar live in `sharedAppBar` so flemo pins them during
      // the slide-left / slide-right segment transitions — only the list
      // content below scrolls past, while the header stays put.
      sharedAppBar={
        showSharedAppBar ? (
          <LibraryHeader segment={segment} onChange={handleSegmentChange} />
        ) : undefined
      }
      sharedNavigationBar={showMiniPlayer ? <PlayerBottomBar activePath="/" /> : undefined}
    >
      <div className="px-5 pb-8 pt-2">
        {segment === "albums" && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {albums.map((album) => (
              <AlbumTile key={album.id} album={album} />
            ))}
          </div>
        )}

        {segment === "songs" && <LibrarySongsList />}

        {segment === "artists" && <LibraryArtistsList />}
      </div>
    </PlayerScreen>
  );
}

export default LibraryScreen;

declare module "@flemo/react" {
  interface RegisterRoute {
    "/": { segment?: Segment };
  }
}
