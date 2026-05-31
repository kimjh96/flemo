"use client";

import { useParams, useStep } from "@flemo/react";

import BottomSheet from "@/app/playground/_components/BottomSheet";
import { albumById } from "@/app/playground/_data/albums";
import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";
import { PlayerScreen } from "@/app/playground/_screens/PlayerScreen";
import usePlayerStore from "@/app/playground/_stores/usePlayerStore";

import NowPlayingArtwork from "./NowPlayingArtwork";
import NowPlayingControls from "./NowPlayingControls";
import NowPlayingHeader from "./NowPlayingHeader";
import NowPlayingProgress from "./NowPlayingProgress";
import { tintBackgroundForHue } from "./NowPlayingScreen.utils";
import NowPlayingSheetBody from "./NowPlayingSheetBody";

import type { NowPlayingSheet, NowPlayingStepParams } from "./NowPlayingScreen.types";

const ELAPSED_PLACEHOLDER = "1:08";
const PROGRESS_PLACEHOLDER = 1 / 3;

function NowPlayingScreen() {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const params = useParams<"/now-playing">();
  const { pushStep, replaceStep, popStep } = useStep<"/now-playing">();
  const dict = usePlaygroundDict();

  const album = albumById(currentTrack.albumId);
  if (!album) return null;

  const sheet = params?.sheet ?? null;
  const sheetOpen = sheet !== null;

  const openSheet = (next: NowPlayingSheet) => pushStep({ sheet: next });
  const swapSheet = (next: NowPlayingSheet) => replaceStep({ sheet: next });
  const closeSheet = () => popStep();
  const handleOpenQueue = () => openSheet("queue");
  const handleOpenLyrics = () => openSheet("lyrics");
  const handleSwapSheet = () => swapSheet(sheet === "lyrics" ? "queue" : "lyrics");

  return (
    <PlayerScreen>
      <div
        className="relative flex h-full w-full flex-col overflow-hidden px-5 pb-8 pt-3"
        style={{ background: tintBackgroundForHue(album.hue) }}
      >
        <NowPlayingHeader />

        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-6">
          <NowPlayingArtwork hue={album.hue} title={currentTrack.title} artist={album.artist} />
          <NowPlayingProgress
            elapsed={ELAPSED_PLACEHOLDER}
            remaining={currentTrack.duration}
            progress={PROGRESS_PLACEHOLDER}
          />
          <NowPlayingControls />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenQueue}
              data-flemo-step-action="open-queue"
              className="rounded-full border border-[var(--color-text-primary)]/15 px-3 py-1 text-[12px] font-semibold text-[var(--color-text-primary)]/70"
            >
              Up Next
            </button>
            <button
              type="button"
              onClick={handleOpenLyrics}
              data-flemo-step-action="open-lyrics"
              className="rounded-full border border-[var(--color-text-primary)]/15 px-3 py-1 text-[12px] font-semibold text-[var(--color-text-primary)]/70"
            >
              Lyrics
            </button>
          </div>

          <div className="w-full rounded-2xl border border-[var(--color-text-primary)]/15 bg-[var(--color-text-primary)]/5 p-4">
            <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              {album.title}
            </div>
            <div className="mt-1 text-[12px] text-[var(--color-ink-soft)]">
              {album.artist} · {album.year} · {album.tracks.length} tracks
            </div>
          </div>
        </div>

        <BottomSheet
          open={sheetOpen}
          onClose={closeSheet}
          title={sheet === "lyrics" ? dict.nowPlaying.lyrics : dict.nowPlaying.upNext}
          trailing={
            <button
              type="button"
              onClick={handleSwapSheet}
              data-flemo-step-action="swap-sheet"
              className="rounded-full bg-[var(--color-text-primary)]/8 px-3 py-1 text-[12px] font-semibold text-[var(--color-text-primary)]"
            >
              {sheet === "lyrics" ? dict.nowPlaying.upNext : dict.nowPlaying.lyrics}
            </button>
          }
        >
          <NowPlayingSheetBody sheet={sheet} album={album} />
        </BottomSheet>
      </div>
    </PlayerScreen>
  );
}

export default NowPlayingScreen;

declare module "@flemo/react" {
  interface RegisterRoute {
    "/now-playing": NowPlayingStepParams;
  }
}
