import { albums } from "@/app/playground/_data/albums";

function LibraryArtistsList() {
  const artists = Array.from(new Set(albums.map((album) => album.artist))).sort();

  return (
    <ul className="flex flex-col divide-y divide-[var(--color-line)]">
      {artists.map((artist) => (
        <li key={artist} className="py-3 text-[14px] font-medium text-[var(--color-text-primary)]">
          {artist}
        </li>
      ))}
    </ul>
  );
}

export default LibraryArtistsList;
