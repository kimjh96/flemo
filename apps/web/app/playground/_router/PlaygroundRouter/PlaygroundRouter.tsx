"use client";

import { Route, Router } from "@flemo/react";

import AlbumScreen from "@/app/playground/_screens/AlbumScreen";
import FetchSwapScreen from "@/app/playground/_screens/FetchSwapScreen";
import HeavyArrivalScreen from "@/app/playground/_screens/HeavyArrivalScreen";
import LibraryScreen from "@/app/playground/_screens/LibraryScreen";
import NowPlayingScreen from "@/app/playground/_screens/NowPlayingScreen";
import SearchScreen from "@/app/playground/_screens/SearchScreen";
import blur from "@/app/playground/_transitions/blur";
import breathe from "@/app/playground/_transitions/breathe";
import cardStack from "@/app/playground/_transitions/cardStack";
import dive, { tunnel } from "@/app/playground/_transitions/dive";
import reveal from "@/app/playground/_transitions/reveal";
import ripple, { ripples } from "@/app/playground/_transitions/ripple";
import slideLeft from "@/app/playground/_transitions/slideLeft";
import slideRight from "@/app/playground/_transitions/slideRight";
import spring from "@/app/playground/_transitions/spring";
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
        ripple,
        dive
      ]}
      decorators={[ripples, tunnel]}
    >
      <Route path="/" element={<LibraryScreen />} />
      <Route path="/search" element={<SearchScreen />} />
      <Route path="/album/:id" element={<AlbumScreen />} />
      <Route path="/now-playing" element={<NowPlayingScreen />} />
      <Route path="/heavy/:cpuMs/:nodes" element={<HeavyArrivalScreen />} />
      <Route path="/fetch-swap/:delayMs/:nodes" element={<FetchSwapScreen />} />
    </Router>
  );
}

export default PlaygroundRouter;
