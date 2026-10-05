"use client";

import { useEffect, useRef } from "react";

import { useNavigate, usePathname } from "@flemo/react";

import { ACTS } from "../../_data/acts";
import { useBench } from "../../_providers/BenchContext";

export interface TonightAutoplayProps {
  enabled: boolean;
}

// Plays the ticket app by itself for the landing hero: open an act from the
// list exactly as a tap on its row would (same params, same transition), rest,
// come back, rest, next act. Rendered inside the Tonight Router, outside its
// <Slot>, so it only ever navigates the mini stack. The playground never
// enables it: a page that moves on its own changes what is being judged.
function TonightAutoplay({ enabled }: TonightAutoplayProps) {
  const navigate = useNavigate();
  const pathname = usePathname();
  const { transition } = useBench();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const cursor = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const onList = pathname === "/tonight";
    const timer = window.setTimeout(
      () => {
        if (onList) {
          const act = ACTS[cursor.current % 4]!;
          cursor.current += 1;
          navigateRef.current.push(
            "/tonight/act/:id",
            { id: act.id, from: "row" },
            { transitionName: transition }
          );
        } else if (pathname.startsWith("/tonight/act/")) {
          navigateRef.current.pop();
        }
      },
      onList ? 1600 : 2600
    );
    return () => window.clearTimeout(timer);
  }, [enabled, pathname, transition]);

  return null;
}

export default TonightAutoplay;
