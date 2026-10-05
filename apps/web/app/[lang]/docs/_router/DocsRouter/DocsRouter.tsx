"use client";

import { Route, Router, Slot } from "@flemo/react";

import { useShellLocaleGetter } from "@/app/[lang]/_providers/ShellIntlProvider";
import createLocaleHistoryDriver from "@/lib/localeHistoryDriver";

import { DocsSearchBridge } from "../../_components/DocsSearch";
import DocsSidebar from "../../_components/DocsSidebar";
import DocPageScreen from "../../_screens/DocPageScreen";
import docBackward from "../../_transitions/docBackward";
import docForward from "../../_transitions/docForward";

import "./DocsRouter.types";

export interface DocsRouterProps {
  // Seeded from the shell's matched slug, so server and client agree on the
  // first page even on a deep link.
  initPath: string;
}

// The docs: a nested Router with browser history. The sidebar sits OUTSIDE the
// <Slot>, so it holds still while only the page area moves.
function DocsRouter({ initPath }: DocsRouterProps) {
  const getLocale = useShellLocaleGetter();

  return (
    <Router
      initPath={initPath}
      createDriver={(key) => createLocaleHistoryDriver(key, getLocale)}
      defaultTransitionName="doc-forward"
      transitions={[docForward, docBackward]}
      className="mx-auto flex h-full w-full max-w-[1280px] bg-bg"
    >
      <DocsSearchBridge />
      <DocsSidebar />
      <Slot className="min-w-0 flex-1">
        <Route path="/docs/:slug" element={<DocPageScreen />} />
      </Slot>
    </Router>
  );
}

export default DocsRouter;
