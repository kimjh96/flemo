"use client";

import { useNavigate } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import MiniPlayer from "../../_components/MiniPlayer";
import MusicScreen from "../../_components/MusicScreen";
import { artworkFor, musicCopy, TRACKS } from "../../_data/tracks";

// The music library: a track list with the mini player pinned as the shared bar.
// Tapping a track rises the Now Playing screen (material).
function MusicLibraryScreen() {
  const lang = useShellLang();
  const navigate = useNavigate();
  const copy = musicCopy(lang);

  const handleOpen = (id: string) =>
    navigate.push("/music/playing/:id", { id }, { transitionName: "material" });

  return (
    <MusicScreen sharedNavigationBar={<MiniPlayer />}>
      <div className="flex h-full flex-col">
        <header className="px-5 pt-6 pb-3">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
            {copy.title}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-disabled)]">{copy.subtitle}</p>
        </header>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {TRACKS.map((track) => (
            <li key={track.id}>
              <button
                type="button"
                onClick={() => handleOpen(track.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-layer)]"
              >
                <span
                  className="size-12 shrink-0 rounded-xl"
                  style={{ background: artworkFor(track.hue) }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {track.title}
                  </span>
                  <span className="block truncate text-xs text-[var(--color-text-disabled)]">
                    {track.artist}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </MusicScreen>
  );
}

export default MusicLibraryScreen;
