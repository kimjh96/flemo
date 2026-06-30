"use client";

import { useState } from "react";

import MusicRouter from "../../_demo/_music/_router/MusicRouter";
import WalletRouter from "../../_demo/_wallet/_router/WalletRouter";

// The hero showpiece: two real flemo apps (a wallet and a music player) inside
// glass bezels, rolling diagonally so each takes a turn up front, with a third
// frosted card behind for depth. Only the bezel is glass; the apps stay solid.
// Both auto-cycle their transitions while idle and pause while the visitor
// interacts (which also lets them tap the front app).
export interface HeroDemoProps {
  // The demos only auto-play while the host screen is active; navigating from a
  // frozen screen's nested Router would wedge the shared task queue.
  active: boolean;
}

const BEZEL =
  "absolute inset-x-0 top-0 h-[500px] rounded-[34px] border border-white/30 bg-white/10 p-1.5 shadow-[0_34px_80px_-26px_rgba(15,23,42,0.55)] backdrop-blur-2xl";

function HeroDemo({ active }: HeroDemoProps) {
  const [interacting, setInteracting] = useState(false);

  const handlePointerEnter = () => setInteracting(true);
  const handlePointerLeave = () => setInteracting(false);

  const playState = interacting ? "paused" : "running";
  const playing = active && !interacting;

  return (
    <div
      className="relative mx-auto w-full max-w-[360px]"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div
        aria-hidden="true"
        className="absolute -top-12 -left-16 z-0 h-[110%] w-[120%] rounded-[45%] opacity-35 blur-[64px]"
        style={{ background: "var(--gradient-blob)" }}
      />
      <div className="relative mx-auto h-[580px] w-[290px]">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[500px] translate-x-[92px] translate-y-[80px] scale-[0.82] rounded-[34px] border border-white/20 bg-white/5 shadow-xl backdrop-blur-xl"
        />
        <div
          className={BEZEL}
          style={{
            animation: "flemo-card-roll 7s ease-in-out infinite",
            animationPlayState: playState
          }}
        >
          <div className="h-full overflow-hidden rounded-[28px]">
            <WalletRouter autoPlay={playing} />
          </div>
        </div>
        <div
          className={BEZEL}
          style={{
            animation: "flemo-card-roll 7s ease-in-out -3.5s infinite",
            animationPlayState: playState
          }}
        >
          <div className="h-full overflow-hidden rounded-[28px]">
            <MusicRouter autoPlay={playing} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeroDemo;
