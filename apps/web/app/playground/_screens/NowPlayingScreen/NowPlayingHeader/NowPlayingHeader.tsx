"use client";

import { useStep } from "@flemo/react";

import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";

function NowPlayingHeader() {
  const dict = usePlaygroundDict();
  // `popStep` first tries to pop a step boundary (e.g., close an open
  // bottom sheet pushed via pushStep). When there's no step to pop, it
  // falls through to a screen pop — same effect as `navigate.pop` but it
  // also unwinds any in-progress useStep state along the way.
  const { popStep } = useStep<"/now-playing">();

  const handleClose = () => popStep();

  return (
    <header className="flex items-center justify-between pb-4">
      <button
        type="button"
        onClick={handleClose}
        aria-label={dict.player.close}
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)]/5"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          <path
            d="M6 9l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-mute)]">
        {dict.nowPlaying.title}
      </div>
      <button
        type="button"
        aria-label={dict.player.more}
        className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)]/5"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="currentColor">
          <circle cx="5" cy="11" r="1.6" />
          <circle cx="11" cy="11" r="1.6" />
          <circle cx="17" cy="11" r="1.6" />
        </svg>
      </button>
    </header>
  );
}

export default NowPlayingHeader;
