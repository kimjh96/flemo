"use client";

import { useState } from "react";

import PlayerBottomBar from "@/app/playground/_components/PlayerBottomBar";
import { albums } from "@/app/playground/_data/albums";
import { PlayerScreen } from "@/app/playground/_screens/PlayerScreen";
import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import SearchAlbumRow from "./SearchAlbumRow";
import SearchAppBar from "./SearchAppBar";
import SearchArtistRow from "./SearchArtistRow";
import SearchSection from "./SearchSection";

const TOP_PICK_LIMIT = 24;

function SearchScreen() {
  const [query, setQuery] = useState("");
  const showMiniPlayer = usePlaygroundSettingsStore((state) => state.showMiniPlayer);

  const trimmed = query.trim().toLowerCase();

  const albumMatches =
    trimmed.length === 0
      ? []
      : albums.filter(
          (album) =>
            album.title.toLowerCase().includes(trimmed) ||
            album.artist.toLowerCase().includes(trimmed)
        );

  const artistMatches =
    trimmed.length === 0
      ? []
      : Array.from(
          new Map(
            albums
              .filter((album) => album.artist.toLowerCase().includes(trimmed))
              .map((album) => [album.artist, album.hue])
          ).entries()
        ).map(([name, hue]) => ({ name, hue }));

  const topPicks = albums.slice(0, TOP_PICK_LIMIT);

  return (
    <PlayerScreen
      appBar={<SearchAppBar query={query} onChange={setQuery} />}
      sharedNavigationBar={showMiniPlayer ? <PlayerBottomBar activePath="/search" /> : undefined}
    >
      <div className="flex flex-col gap-6 px-5 pb-8 pt-2">
        {trimmed.length === 0 && (
          <SearchSection title="Top Picks">
            {topPicks.map((album) => (
              <SearchAlbumRow key={album.id} album={album} />
            ))}
          </SearchSection>
        )}

        {trimmed.length > 0 && artistMatches.length > 0 && (
          <SearchSection title="Artists">
            {artistMatches.map((artist) => (
              <SearchArtistRow key={artist.name} name={artist.name} hue={artist.hue} />
            ))}
          </SearchSection>
        )}

        {trimmed.length > 0 && albumMatches.length > 0 && (
          <SearchSection title="Albums">
            {albumMatches.map((album) => (
              <SearchAlbumRow key={album.id} album={album} />
            ))}
          </SearchSection>
        )}

        {trimmed.length > 0 && albumMatches.length === 0 && artistMatches.length === 0 && (
          <div className="py-10 text-center text-[14px] text-[var(--color-ink-mute)]">
            No matches
          </div>
        )}
      </div>
    </PlayerScreen>
  );
}

export default SearchScreen;

declare module "@flemo/react" {
  interface RegisterRoute {
    "/search": undefined;
  }
}
