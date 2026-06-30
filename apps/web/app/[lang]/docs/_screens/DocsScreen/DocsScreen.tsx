"use client";

import { Screen, useParams } from "@flemo/react";

import DocsRouter from "../../_router/DocsRouter";

// The Docs peer, full-bleed. Entered from the header with a slide in from the
// right; inside, the sidebar persists and the page area transitions on its own.
// The shell's matched slug seeds the nested Router (server and client alike), so
// a deep link server-renders the right doc page with no hydration mismatch.
function DocsScreen() {
  const params = useParams<"/docs/:slug">();
  const initPath = `/docs/${params?.slug ?? "introduction"}`;

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <DocsRouter initPath={initPath} />
    </Screen>
  );
}

export default DocsScreen;
