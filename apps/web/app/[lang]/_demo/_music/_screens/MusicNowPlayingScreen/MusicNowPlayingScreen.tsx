"use client";

import { useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import MusicScreen from "../../_components/MusicScreen";
import { artworkFor, musicCopy, trackById } from "../../_data/tracks";

// Now Playing: a barless screen, so the mini player animates away as it rises.
// The chevron pops back. Controls are decorative for the demo.
function MusicNowPlayingScreen() {
  const lang = useShellLang();
  const navigate = useNavigate();
  const params = useParams<"/music/playing/:id">();
  const track = trackById(params?.id ?? "1");
  const copy = musicCopy(lang);

  const handleClose = () => navigate.pop();

  if (!track) return null;

  return (
    <MusicScreen>
      <div className="flex h-full flex-col px-6 pt-5 pb-8">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="grid size-9 cursor-pointer place-items-center rounded-full text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-layer)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="text-xs font-bold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
            {copy.nowPlaying}
          </span>
          <span className="size-9" aria-hidden="true" />
        </header>

        <div
          className="mt-4 aspect-square w-full rounded-3xl shadow-lg"
          style={{ background: artworkFor(track.hue) }}
          aria-hidden="true"
        />

        <div className="mt-6">
          <h2 className="text-xl font-extrabold text-[var(--color-text-primary)]">{track.title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{track.artist}</p>
        </div>

        <div className="mt-5 h-1 w-full rounded-full bg-[var(--color-layer)]">
          <div className="h-full w-1/3 rounded-full bg-[var(--color-primary)]" />
        </div>

        <div className="mt-auto flex items-center justify-center gap-8 pt-6 text-[var(--color-text-primary)]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 6h2v12H6zM20 6l-9 6 9 6z" />
          </svg>
          <span className="grid size-14 place-items-center rounded-full bg-[var(--color-primary)] text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16 6h2v12h-2zM4 6l9 6-9 6z" />
          </svg>
        </div>
      </div>
    </MusicScreen>
  );
}

export default MusicNowPlayingScreen;
