"use client";

import { Route, Router, Slot } from "@flemo/react";

import MusicAutoPlay from "../../_components/MusicAutoPlay";
import MusicLibraryScreen from "../../_screens/MusicLibraryScreen";
import MusicNowPlayingScreen from "../../_screens/MusicNowPlayingScreen";

import "./MusicRouter.types";

export interface MusicRouterProps {
  autoPlay?: boolean;
}

// The music mini-app: a NESTED Router (local history, no browser URL) for the
// landing hero's second demo card. Library pins the mini player as a shared bar;
// Now Playing rises (material) without it, so the bar animates away and back.
function MusicRouter({ autoPlay = false }: MusicRouterProps) {
  return (
    <Router
      initPath="/music"
      history="memory"
      defaultTransitionName="cupertino"
      className="h-full w-full bg-[var(--color-bg)]"
    >
      <Slot className="h-full w-full">
        <Route path="/music" element={<MusicLibraryScreen />} />
        <Route path="/music/playing/:id" element={<MusicNowPlayingScreen />} />
      </Slot>
      <MusicAutoPlay active={autoPlay} />
    </Router>
  );
}

export default MusicRouter;
