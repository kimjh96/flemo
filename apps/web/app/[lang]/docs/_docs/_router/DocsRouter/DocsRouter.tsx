"use client";

import { Route, Router, Slot } from "@flemo/react";

import { useShellLocaleGetter } from "@/app/[lang]/_providers/ShellIntlProvider";
import createLocaleHistoryDriver from "@/lib/localeHistoryDriver";

import docStepBackward from "@/app/[lang]/_transitions/docStepBackward";
import docStepForward from "@/app/[lang]/_transitions/docStepForward";

import DocsSidebar from "../../_components/DocsSidebar";
import DocPageScreen from "../../_screens/DocPageScreen";

import "./DocsRouter.types";

export interface DocsRouterProps {
  // Seeded from the shell's matched slug (DocsScreen), so the server and client
  // agree on the first doc page even on a deep link.
  initPath: string;
}

// The docs zone: a nested Router whose persistent sidebar sits OUTSIDE the
// content <Slot>, so it stays put while only the right-hand page area
// transitions between docs (a shared-axis slide). Full-bleed, no container.
function DocsRouter({ initPath }: DocsRouterProps) {
  const getLocale = useShellLocaleGetter();

  return (
    <Router
      initPath={initPath}
      createDriver={(key) => createLocaleHistoryDriver(key, getLocale)}
      transitions={[docStepForward, docStepBackward]}
      className="mx-auto flex h-full w-full max-w-[1200px] bg-[var(--color-bg)]"
    >
      <DocsSidebar />
      <Slot className="min-w-0 flex-1">
        <Route path="/docs/:slug" element={<DocPageScreen />} />
      </Slot>
    </Router>
  );
}

export default DocsRouter;
