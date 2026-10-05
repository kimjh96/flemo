"use client";

import { Screen, useParams } from "@flemo/react";

import DocsRouter from "../../_router/DocsRouter";

// The docs section as a screen of the site's Router. Inside it, the docs run
// their own nested Router: the sidebar stays, pages move.
function DocsScreen() {
  const params = useParams<"/docs/:slug">();
  const initPath = `/docs/${params?.slug ?? "introduction"}`;

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--bg)">
      <div className="h-full pt-14">
        <DocsRouter initPath={initPath} />
      </div>
    </Screen>
  );
}

export default DocsScreen;
