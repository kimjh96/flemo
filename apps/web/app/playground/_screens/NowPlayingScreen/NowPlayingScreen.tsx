"use client";

import { albumById } from "@/app/playground/_data/albums";
import { PlayerScreen } from "@/app/playground/_screens/PlayerScreen";
import usePlayerStore from "@/app/playground/_stores/usePlayerStore";

import NowPlayingArtwork from "./NowPlayingArtwork";
import NowPlayingControls from "./NowPlayingControls";
import NowPlayingHeader from "./NowPlayingHeader";
import NowPlayingProgress from "./NowPlayingProgress";
import { tintBackgroundForHue } from "./NowPlayingScreen.utils";

const ELAPSED_PLACEHOLDER = "1:08";
const PROGRESS_PLACEHOLDER = 1 / 3;

function NowPlayingScreen() {
  const currentTrack = usePlayerStore((state) => state.currentTrack);

  const album = albumById(currentTrack.albumId);
  if (!album) return null;

  return (
    <PlayerScreen>
      <div
        className="flex h-full w-full flex-col px-5 pb-8 pt-3"
        style={{ background: tintBackgroundForHue(album.hue) }}
      >
        <NowPlayingHeader />

        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <NowPlayingArtwork hue={album.hue} title={currentTrack.title} artist={album.artist} />
          <NowPlayingProgress
            elapsed={ELAPSED_PLACEHOLDER}
            remaining={currentTrack.duration}
            progress={PROGRESS_PLACEHOLDER}
          />
          <NowPlayingControls />
        </div>
      </div>
    </PlayerScreen>
  );
}

export default NowPlayingScreen;

declare module "@flemo/react" {
  interface RegisterRoute {
    "/now-playing": undefined;
  }
}
