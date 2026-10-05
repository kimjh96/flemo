"use client";

import { useRef, useState } from "react";

import DeviceFrame from "@/components/DeviceFrame";
import SegmentedControl from "@/components/SegmentedControl";
import TransitionReadout from "@/app/[lang]/_components/TransitionReadout";
import useAutoplayGate from "@/app/[lang]/_hooks/useAutoplayGate";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";
import TonightRouter from "@/app/[lang]/playground/_router/TonightRouter";
import { CASES, type BenchCase } from "@/app/[lang]/playground/_providers/BenchContext";
import { benchSpec } from "@/app/[lang]/playground/_data/benchSpecs";

// The four cases the hero offers. The container transform leads because it
// shows the most of the library at a glance; the rest are one preset each way
// plus one authored transition, to make the point that a consumer's own
// transition is not a second class of thing.
const HERO_CASES = ["zoom", "cupertino", "material", "sheet"] as const;

const heroCases: BenchCase[] = HERO_CASES.map((id) => CASES.find((entry) => entry.id === id)!);

// The landing's live demo: the playground's ticket app in a device, playing
// itself until the visitor touches it, with the readout underneath showing
// which transition is carrying each transition and on what curve.
function HeroDemo() {
  const t = useShellDict().home;
  const [bench, setBench] = useState<BenchCase>(heroCases[0]!);
  const frameRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const play = useAutoplayGate(frameRef);

  return (
    <div ref={frameRef} className="flex w-full flex-col items-center gap-4">
      <div ref={glassRef}>
        <DeviceFrame glow height="min(640px, calc(100dvh - 15.5rem))">
          <TonightRouter key={bench.id} bench={bench} autoplay={play} />
        </DeviceFrame>
      </div>
      <div className="flex w-[360px] max-w-full flex-col gap-2.5">
        <SegmentedControl
          label={t.demoLabel}
          options={heroCases.map((entry) => ({ value: entry.id, label: entry.id }))}
          value={bench.id}
          onChange={(id) => setBench(heroCases.find((entry) => entry.id === id)!)}
          size="sm"
          mono
          className="w-full justify-between [&>button]:flex-1"
        />
        <TransitionReadout
          hostRef={glassRef}
          name={bench.transition}
          spec={benchSpec(bench.transition)}
        />
      </div>
    </div>
  );
}

export default HeroDemo;
