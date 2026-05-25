"use client";

import { albums } from "@/app/playground/_data/albums";
import usePlayerStore from "@/app/playground/_stores/usePlayerStore";

import LibrarySongRow from "./LibrarySongRow";

const VISIBLE_TRACK_COUNT = 60;

function LibrarySongsList() {
  const setTrack = usePlayerStore((state) => state.setTrack);
  const allTracks = albums.flatMap((album) => album.tracks);

  return (
    <ul className="flex flex-col divide-y divide-[var(--color-line)]">
      {allTracks.slice(0, VISIBLE_TRACK_COUNT).map((track) => (
        <LibrarySongRow key={track.id} track={track} onSelect={setTrack} />
      ))}
    </ul>
  );
}

export default LibrarySongsList;
