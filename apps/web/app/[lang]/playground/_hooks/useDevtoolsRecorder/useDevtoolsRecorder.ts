"use client";

import { useEffect } from "react";

import { attachFlightRecorder } from "@flemo/devtools";

// PLAIN TOP-LEVEL IMPORT, on purpose: this file is the reference a consumer
// copies, and the point of @flemo/devtools' `exports` map is that this is the
// safe way to write it. The package resolves to its inert production entry
// (src/noop.ts) whenever the bundler builds for production, so the recorder
// never reaches a visitor's bundle.
//
// Arms for the session the same way the engine's URL toggles do:
//   ?devtools=on  → sessionStorage flemo:devtools = "on"
//   ?devtools=off → key removed
// A URL visit writes the key eagerly so the toggle survives the SPA router
// rewriting the query away on the next navigation. While armed, the recorder
// installs window.flemo — run `copy(JSON.stringify(window.flemo.report()))`
// and hand the JSON to a coding agent.
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

    // The e2e suite builds for PRODUCTION on purpose (dev's fast-refresh work
    // flakes the timing-sensitive specs) but still needs the real recorder, so
    // it opts in explicitly. `@flemo/devtools/force` is the unconditioned
    // subpath: it resolves to the tool whatever the build mode, and the import
    // is dynamic behind a build-time constant so a deployment — which sets
    // neither — never pulls it.
    if (process.env.NEXT_PUBLIC_FLEMO_DEVTOOLS === "1") {
      let detach: (() => void) | null = null;
      let cancelled = false;
      void import("@flemo/devtools/force").then((forced) => {
        if (!cancelled) detach = forced.attachFlightRecorder({ log: true }).detach;
      });
      return () => {
        cancelled = true;
        detach?.();
      };
    }

    // The ordinary path. Plain import, no guard: in a production build the
    // package resolves to its inert entry on its own.
    return attachFlightRecorder({ log: true }).detach;
  }, []);
};

export default useDevtoolsRecorder;
