"use client";

import { Screen, useParams } from "@flemo/react";

import LabSettingsProvider from "../../_providers/LabSettingsProvider";
import LabRouter from "../../_router/LabRouter";

// The Playground peer, a full-bleed immersive stage. The whole viewport is the
// demo; a floating control bar picks the transition and steps through panels,
// so flemo's motion is experienced at full scale, not in a phone preview.
// Entered from the header with the dramatic full-page shove transition. The
// shell's matched panel number seeds the nested Router on both server and
// client, so a deep link server-renders the right panel with no mismatch.
function PlaygroundScreen() {
  const params = useParams<"/playground/:n">();
  // Forward the `code` step query so a deep link (/playground/1?code=x) seeds the
  // nested Router with the source panel open, on both server and client.
  const code = params?.code;
  const initPath = `/playground/${params?.n ?? "1"}${code ? `?code=${code}` : ""}`;

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <LabSettingsProvider>
        <div className="h-full w-full">
          <LabRouter initPath={initPath} />
        </div>
      </LabSettingsProvider>
    </Screen>
  );
}

export default PlaygroundScreen;
