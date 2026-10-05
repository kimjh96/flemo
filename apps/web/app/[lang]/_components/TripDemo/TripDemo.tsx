"use client";

import { useRef } from "react";

import DeviceFrame from "@/components/DeviceFrame";
import TripRouter from "@/app/[lang]/_demo/_router/TripRouter";
import TransitionReadout, { builtInSpec } from "@/app/[lang]/_components/TransitionReadout";
import useAutoplayGate from "@/app/[lang]/_hooks/useAutoplayGate";

export interface TripDemoProps {
  height?: string;
  className?: string;
}

// The composition demo: the Places app with a shared header, a Morph, a nested
// Router and a Layer together, in the same device and with the same readout as
// every other live demo. It plays itself while on screen and hands over the
// moment it is touched.
function TripDemo({ height = "420px", className }: TripDemoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const play = useAutoplayGate(frameRef);

  return (
    <div ref={frameRef} className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
      <div ref={glassRef}>
        <DeviceFrame height={height}>
          <TripRouter autoplay={play} />
        </DeviceFrame>
      </div>
      <TransitionReadout
        hostRef={glassRef}
        name="cupertino"
        spec={builtInSpec("cupertino")}
        className="w-full max-w-[340px]"
      />
    </div>
  );
}

export default TripDemo;
