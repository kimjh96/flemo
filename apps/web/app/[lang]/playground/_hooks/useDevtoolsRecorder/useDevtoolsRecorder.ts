"use client";

import { useEffect } from "react";

import { attachDevtoolsPanel, attachFlightRecorder } from "@flemo/devtools";

// Arms the flight recorder for the playground session. Mirrors the engine's
// URL-arming pattern (layerSettleHold's ?flemo-layers= sync): a URL visit
// writes the session key eagerly, so the toggle survives the SPA router
// rewriting the query away on the next navigation.
//   ?devtools=on  → sessionStorage flemo:devtools = "on" (armed for session)
//   ?devtools=off → key removed (disarmed)
// While armed, the recorder installs window.flemo — run
// `copy(JSON.stringify(window.flemo.report()))` in the console and hand the
// JSON to a coding agent — and the visual panel mounts alongside it for the
// human reading. The panel never touches the DOM during a flight (see its
// entry file), so having it up does not change the motion being judged.
const useDevtoolsRecorder = () => {
  useEffect(() => {
    let armed = false;
    try {
      if (/[?&]devtools=on\b/.test(location.search)) {
        sessionStorage.setItem("flemo:devtools", "on");
      } else if (/[?&]devtools=off\b/.test(location.search)) {
        sessionStorage.removeItem("flemo:devtools");
      }
      armed = sessionStorage.getItem("flemo:devtools") === "on";
    } catch {
      // Storage unavailable (partitioned iframe): honor the URL directly.
      armed = /[?&]devtools=on\b/.test(location.search);
    }
    if (!armed) return undefined;
    const recorder = attachFlightRecorder({ log: true });
    const panel = attachDevtoolsPanel({ recorder });
    return () => {
      panel.detach();
      recorder.detach();
    };
  }, []);
};

export default useDevtoolsRecorder;
