"use client";

import usePlayerStore from "@/app/playground/_stores/usePlayerStore";

function NowPlayingControls() {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        aria-label="Previous"
        className="grid h-12 w-12 place-items-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)]/8"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="currentColor">
          <path d="M5 4v14h2V4H5zm14 0L9 11l10 7V4z" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={togglePlay}
        className="grid h-16 w-16 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-primary)]"
      >
        {isPlaying ? (
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="currentColor">
            <rect x="5" y="3" width="4" height="16" rx="0.6" />
            <rect x="13" y="3" width="4" height="16" rx="0.6" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="currentColor">
            <path d="M5 3v16l14-8z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        aria-label="Next"
        className="grid h-12 w-12 place-items-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)]/8"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="currentColor">
          <path d="M15 4v14h2V4h-2zM3 4v14l10-7L3 4z" />
        </svg>
      </button>
    </div>
  );
}

export default NowPlayingControls;
