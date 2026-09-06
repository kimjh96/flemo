"use client";

import { useLayoutEffect, useRef, useState } from "react";

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

const ROLL_SECONDS = 7;

// The shared roll clock: phase = ACCUMULATED RUNNING TIME, not wall time.
// Two behaviors hang on that distinction:
// - Hovering pauses the animation AND this clock, so un-hovering resumes the
//   roll from the exact pose it paused at (a wall-clock phase teleported the
//   paused cards on every re-render — the "hover snaps the demo" defect).
// - Navigating away freezes the screen (display: none terminates CSS
//   animations) but leaves the clock running, so a return re-anchors the roll
//   as if it had carried on the whole time — never the same leading card, and
//   no phase-zero reset at the landing.
const rollClock = {
  baseMs: 0,
  // STARTED BY THE FIRST MOUNT, not by the bundle being parsed.
  //
  // `Date.now()` here made the clock run from script evaluation, so by the time
  // the first layout effect anchored the cards the phase was already tens of
  // milliseconds in and the anchor moved them off the pose the markup had just
  // painted. Null means the first `resume()` starts it at zero, which is
  // exactly the phase the static delays below render, so the anchor is a no-op
  // on a fresh load and a correction on every later one.
  runningSince: null as number | null,
  phaseMs() {
    return this.baseMs + (this.runningSince === null ? 0 : Date.now() - this.runningSince);
  },
  pause() {
    if (this.runningSince === null) return;
    this.baseMs += Date.now() - this.runningSince;
    this.runningSince = null;
  },
  resume() {
    if (this.runningSince === null) this.runningSince = Date.now();
  }
};

const rollDelay = (offsetSeconds: number) =>
  `${-((rollClock.phaseMs() / 1000 + offsetSeconds) % ROLL_SECONDS)}s`;

// THE POSE THE MARKUP ITSELF CARRIES, phase zero, on the server and on the
// first client render alike.
//
// The offset used to be applied only by the layout effect below, on the
// reasoning that keeping it out of the markup is what keeps SSR phase-free.
// It does — and it also meant the served HTML gave both cards the SAME
// animation with the SAME (absent) delay, so both sat at the keyframe's 0%
// pose: identical transform, identical z-index, stacked exactly on top of each
// other with the music card, later in DOM order, covering the wallet outright.
// That is what the browser painted before hydration, and the anchor then threw
// the music card back to its receded pose in one frame. Reported from a screen
// recording as the demo flickering and resetting on every refresh.
//
// These two values ARE what `rollDelay` returns at phase zero, so nothing has
// two sources of truth: the markup paints the separated pose immediately, the
// clock starts at zero on the first mount, and the anchor below agrees with
// both.
const PHASE_ZERO_DELAY = (offsetSeconds: number) => `-${offsetSeconds % ROLL_SECONDS}s`;

function HeroDemo({ active }: HeroDemoProps) {
  const [interacting, setInteracting] = useState(false);
  const walletBezelRef = useRef<HTMLDivElement | null>(null);
  const musicBezelRef = useRef<HTMLDivElement | null>(null);

  const handlePointerEnter = () => setInteracting(true);
  const handlePointerLeave = () => setInteracting(false);

  const playState = interacting ? "paused" : "running";
  const playing = active && !interacting;

  // Re-align the CSS animations to the shared clock at mount, at every unfreeze
  // (Activity re-runs effects), and at every hover release — and ONLY then.
  // While paused nothing may touch the delay: the pose must stand still.
  //
  // On a fresh load this changes nothing: the clock starts at zero here and the
  // markup already carries the phase-zero delays, so the pose the browser
  // painted is the pose it keeps. It earns its place on a RETURN, where the
  // clock has run on while the screen was frozen and the cards have to
  // re-anchor to where the roll would have carried them.
  useLayoutEffect(() => {
    if (interacting) {
      rollClock.pause();
      return;
    }
    rollClock.resume();
    if (walletBezelRef.current) walletBezelRef.current.style.animationDelay = rollDelay(0);
    if (musicBezelRef.current) {
      musicBezelRef.current.style.animationDelay = rollDelay(ROLL_SECONDS / 2);
    }
  }, [interacting]);

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
          ref={walletBezelRef}
          className={BEZEL}
          style={{
            animation: "flemo-card-roll 7s ease-in-out infinite",
            animationDelay: PHASE_ZERO_DELAY(0),
            animationPlayState: playState
          }}
        >
          <div className="h-full overflow-hidden rounded-[28px]">
            <WalletRouter autoPlay={playing} />
          </div>
        </div>
        <div
          ref={musicBezelRef}
          className={BEZEL}
          style={{
            animation: "flemo-card-roll 7s ease-in-out infinite",
            animationDelay: PHASE_ZERO_DELAY(ROLL_SECONDS / 2),
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
