"use client";

import { useEffect, useRef } from "react";

import { useNavigate, usePathname } from "@flemo/react";

export interface TripAutoplayProps {
  enabled: boolean;
}

const REST_HOME = 1600;
const REST_PLACE = 2400;

// Plays the composition demo by itself while nobody is touching it: open the
// featured place, so the card grows and the header title changes, then go
// back. Rendered inside the app's Router, outside its <Slot>, so it navigates
// the demo's stack and never the site's.
function TripAutoplay({ enabled }: TripAutoplayProps) {
  const navigate = useNavigate();
  const pathname = usePathname();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!enabled) return undefined;
    const home = pathname === "/trip";
    const timer = window.setTimeout(
      () => {
        if (home) navigateRef.current.push("/trip/:id", { id: "kyoto" });
        else navigateRef.current.pop();
      },
      home ? REST_HOME : REST_PLACE
    );
    return () => window.clearTimeout(timer);
  }, [enabled, pathname]);

  return null;
}

export default TripAutoplay;
