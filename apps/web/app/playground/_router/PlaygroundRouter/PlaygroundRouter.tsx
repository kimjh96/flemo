"use client";

import { Route, Router } from "@flemo/react";

import AlbumScreen from "@/app/playground/_screens/AlbumScreen";
import HeavyArrivalScreen from "@/app/playground/_screens/HeavyArrivalScreen";
import LibraryScreen from "@/app/playground/_screens/LibraryScreen";
import NowPlayingScreen from "@/app/playground/_screens/NowPlayingScreen";
import SearchScreen from "@/app/playground/_screens/SearchScreen";
import blur from "@/app/playground/_transitions/blur";
import breathe from "@/app/playground/_transitions/breathe";
import cardStack from "@/app/playground/_transitions/cardStack";
import reveal from "@/app/playground/_transitions/reveal";
import sheet, { frost } from "@/app/playground/_transitions/sheet";
import slideLeft from "@/app/playground/_transitions/slideLeft";
import slideRight from "@/app/playground/_transitions/slideRight";
import spotlight, { vignette } from "@/app/playground/_transitions/spotlight";
import spring from "@/app/playground/_transitions/spring";
import swoosh, { scrim } from "@/app/playground/_transitions/swoosh";
import zoom from "@/app/playground/_transitions/zoom";

import "./PlaygroundRouter.types";

function PlaygroundRouter() {
  return (
    <Router
      defaultTransitionName="cupertino"
      transitions={[
        breathe,
        blur,
        slideLeft,
        slideRight,
        zoom,
        cardStack,
        reveal,
        spring,
        spotlight,
        sheet,
        swoosh
      ]}
      decorators={[vignette, frost, scrim]}
    >
      <Route path="/" element={<LibraryScreen />} />
      <Route path="/search" element={<SearchScreen />} />
      <Route path="/album/:id" element={<AlbumScreen />} />
      <Route path="/now-playing" element={<NowPlayingScreen />} />
      <Route path="/heavy/:cpuMs/:nodes" element={<HeavyArrivalScreen />} />
    </Router>
  );
}

export default PlaygroundRouter;
