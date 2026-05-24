"use client";

import { Route, Router } from "@flemo/react";

import AlbumScreen from "@/app/playground/_screens/AlbumScreen";
import LibraryScreen from "@/app/playground/_screens/LibraryScreen";
import NowPlayingScreen from "@/app/playground/_screens/NowPlayingScreen";
import SearchScreen from "@/app/playground/_screens/SearchScreen";
import blur from "@/app/playground/_transitions/blur";
import breathe from "@/app/playground/_transitions/breathe";
import slideLeft from "@/app/playground/_transitions/slideLeft";
import slideRight from "@/app/playground/_transitions/slideRight";

import "./PlaygroundRouter.types";

function PlaygroundRouter() {
  return (
    <Router defaultTransitionName="cupertino" transitions={[breathe, blur, slideLeft, slideRight]}>
      <Route path="/" element={<LibraryScreen />} />
      <Route path="/search" element={<SearchScreen />} />
      <Route path="/album/:id" element={<AlbumScreen />} />
      <Route path="/now-playing" element={<NowPlayingScreen />} />
    </Router>
  );
}

export default PlaygroundRouter;
