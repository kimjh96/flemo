"use client";

import { useRef } from "react";

import DeviceFrame from "@/components/DeviceFrame";
import MiniRouter from "@/app/[lang]/_demo/_router/MiniRouter";
import { DEFAULT_MINI, type MiniConfig } from "@/app/[lang]/_demo/_providers/MiniContext";
import TransitionReadout, { builtInSpec } from "@/app/[lang]/_components/TransitionReadout";
import useAutoplayGate from "@/app/[lang]/_hooks/useAutoplayGate";

export interface MiniDemoProps {
  config?: Partial<MiniConfig>;
  height?: string;
  readout?: boolean;
  autoplay?: boolean;
  className?: string;
}

// A live demo: the Places app in a small device, playing itself while it is on
// screen and handing over to the visitor the moment they touch it. Changing the
// config remounts the app, so a switch always starts from a clean stack instead
// of landing mid-transition.
function MiniDemo({
  config,
  height = "440px",
  readout,
  autoplay = true,
  className
}: MiniDemoProps) {
  const resolved: MiniConfig = { ...DEFAULT_MINI, ...config };
  const frameRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const play = useAutoplayGate(frameRef);

  return (
    <div ref={frameRef} className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
      <div ref={glassRef}>
        <DeviceFrame height={height}>
          <MiniRouter
            key={`${resolved.transition}-${resolved.morph}-${resolved.part}`}
            config={resolved}
            autoplay={autoplay && play}
          />
        </DeviceFrame>
      </div>
      {readout && (
        <TransitionReadout
          hostRef={glassRef}
          name={resolved.transition}
          spec={builtInSpec(resolved.transition)}
          className="w-full max-w-[340px]"
        />
      )}
    </div>
  );
}

export default MiniDemo;
