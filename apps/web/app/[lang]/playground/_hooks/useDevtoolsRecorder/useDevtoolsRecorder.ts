"use client";

import { useEffect } from "react";

// Arms the flight recorder for the playground session. Mirrors the engine's
// URL-arming pattern (layerSettleHold's ?flemo-layers= sync): a URL visit
// writes the session key eagerly, so the toggle survives the SPA router
// rewriting the query away on the next navigation.
//   ?devtools=on  → sessionStorage flemo:devtools = "on" (armed for session)
//   ?devtools=off → key removed (disarmed)
// While armed, the recorder installs window.flemo — run
// `copy(JSON.stringify(window.flemo.report()))` in the console and hand the
// JSON to a coding agent.
//
// The import is DYNAMIC and behind a build-time constant on purpose, and this
// file is the reference a consumer will copy. `devDependencies` decides what
// gets INSTALLED, not what gets BUNDLED: a plain top-level import of a package
// you call at runtime ships to every visitor no matter which dependency field
// it sits in — measured on this very site, where the recorder's strings were
// found in a production chunk. Bundlers replace `process.env.NODE_ENV` (Vite:
// `import.meta.env.DEV`) at build time, so this branch — and the module behind
// it — is eliminated from the production build entirely.
const useDevtoolsRecorder = () => {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return undefined;

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

    // The effect may unmount before the chunk resolves; detach whatever
    // attached, and never attach at all if we are already gone.
    let detach: (() => void) | null = null;
    let cancelled = false;
    void import("@flemo/devtools").then(({ attachFlightRecorder }) => {
      if (cancelled) return;
      detach = attachFlightRecorder({ log: true }).detach;
    });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, []);
};

export default useDevtoolsRecorder;
