"use client";

import { useEffect, useState } from "react";

import ShellIntlProvider from "@/app/[lang]/(app)/_providers/ShellIntlProvider";
import ShellRouter from "@/app/[lang]/(app)/_router/ShellRouter";

export interface ShellAppProps {
  lang: string;
}

// Client entry for the flemo app-shell preview. The root <Router> seeds its
// history from `window.location.pathname` on first render, but this route is
// served at `/shell` (or `/ko/shell`), a path no shell <Route> matches, which
// would crash the Renderer. So rewrite the URL to "/" before mounting, then
// render — the same seam the /playground island uses.
//
// PR1 limitation (resolved by the zone history driver in a follow-up): the root
// Router writes real paths to the browser, so navigating to Showcase sets the
// URL to /showcase and a hard refresh leaves this preview for the live pages.
// Locale-prefixed URL sync (/ko/...) also lands with that driver. The in-session
// shell, its layout, and the shared-axis transitions are what this preview
// verifies.
function ShellApp({ lang }: ShellAppProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <ShellIntlProvider lang={lang}>
      <ShellRouter />
    </ShellIntlProvider>
  );
}

export default ShellApp;
