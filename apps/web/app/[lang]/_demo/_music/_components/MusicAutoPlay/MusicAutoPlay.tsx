"use client";

import { useEffect, useRef } from "react";

import { useNavigate } from "@flemo/react";

import { TRACKS } from "../../_data/tracks";

export interface MusicAutoPlayProps {
  // Only loops while the host screen is active (see HeroDemo). A longer,
  // offset period from the wallet demo keeps the two nested Routers from firing
  // navigations on the same tick into the shared task queue.
  active: boolean;
}

function MusicAutoPlay({ active }: MusicAutoPlayProps) {
  const navigate = useNavigate();
  const stepRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => {
      const open = stepRef.current % 2 === 0;
      if (open) {
        navigate.push("/music/playing/:id", { id: TRACKS[2]!.id }, { transitionName: "material" });
      } else {
        navigate.pop();
      }
      stepRef.current += 1;
    }, 3400);

    return () => clearInterval(timer);
  }, [active, navigate]);

  return null;
}

export default MusicAutoPlay;
