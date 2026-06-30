"use client";

import { useEffect, useRef } from "react";

import { useNavigate, usePathname } from "@flemo/react";

export interface WalletAutoPlayProps {
  active: boolean;
}

// Drives the demo on its own so flemo's motion shows without the visitor
// touching it. The loop, derived from the current path: Home -> Activity
// (shared-axis, shared bar stays pinned) -> Detail (cupertino push, the shared
// bar animates away) -> back to Activity (the bar returns) -> Home. Pauses while
// the visitor is interacting (active=false), and never fights a screen they
// opened themselves (e.g. Send). Renders nothing.
function WalletAutoPlay({ active }: WalletAutoPlayProps) {
  const navigate = useNavigate();
  const path = usePathname();
  const visitedDetail = useRef(false);

  useEffect(() => {
    if (!active) return;

    const timer = setTimeout(() => {
      if (path === "/wallet/home") {
        visitedDetail.current = false;
        navigate.replace("/wallet/activity", {}, { transitionName: "shared-axis-forward" });
      } else if (path === "/wallet/activity") {
        if (visitedDetail.current) {
          navigate.replace("/wallet/home", {}, { transitionName: "shared-axis-backward" });
        } else {
          navigate.push("/wallet/tx/:id", { id: "3" });
        }
      } else if (path.startsWith("/wallet/tx/")) {
        visitedDetail.current = true;
        navigate.pop();
      }
    }, 2600);

    return () => clearTimeout(timer);
  }, [active, path, navigate]);

  return null;
}

export default WalletAutoPlay;
