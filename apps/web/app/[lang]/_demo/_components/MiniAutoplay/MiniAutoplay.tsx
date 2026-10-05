"use client";

import { useEffect, useRef } from "react";

import { useNavigate, usePathname } from "@flemo/react";

import { PLACE_IDS } from "../../_data/places";

export interface MiniAutoplayProps {
  enabled: boolean;
  // How long the list rests before the next push, and how long the detail rests
  // before the pop. Each runs from the moment the path changes.
  restList?: number;
  restDetail?: number;
}

let cursor = 0;

// Plays the app by itself while nobody is touching it: push a place, rest, pop,
// rest, next place. Rendered inside the mini Router (outside its <Slot>), so it
// navigates the mini stack and never the site's.
function MiniAutoplay({ enabled, restList = 1400, restDetail = 2400 }: MiniAutoplayProps) {
  const navigate = useNavigate();
  const pathname = usePathname();
  // Held in a ref so a re-render of the surrounding page does not restart the
  // rest period: only a path change does.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!enabled) return undefined;
    const onList = pathname === "/mini";
    const timer = window.setTimeout(
      () => {
        if (onList) {
          const id = PLACE_IDS[cursor % PLACE_IDS.length]!;
          cursor += 1;
          navigateRef.current.push("/mini/:id", { id });
        } else {
          navigateRef.current.pop();
        }
      },
      onList ? restList : restDetail
    );
    return () => window.clearTimeout(timer);
  }, [enabled, pathname, restList, restDetail]);

  return null;
}

export default MiniAutoplay;
