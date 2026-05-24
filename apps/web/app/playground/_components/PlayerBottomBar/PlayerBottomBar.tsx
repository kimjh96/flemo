"use client";

import MiniPlayer from "./MiniPlayer";
import TabBar, { type TabPath } from "./TabBar";

export interface PlayerBottomBarProps {
  activePath: TabPath;
}

function PlayerBottomBar({ activePath }: PlayerBottomBarProps) {
  return (
    <div>
      <MiniPlayer />
      <TabBar activePath={activePath} />
    </div>
  );
}

export default PlayerBottomBar;
