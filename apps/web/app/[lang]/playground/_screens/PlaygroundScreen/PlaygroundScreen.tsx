"use client";

import { Screen } from "@flemo/react";

import BenchStage from "../../_components/BenchStage";
import ChainStage from "../../_components/ChainStage";

// The playground as a PEER of Home, Showcase and Docs: a screen of the shell's
// own Router rather than a page beside it.
//
// Which means the fixtures are nested Routers inside a screen of another
// Router, on a site that is itself a flemo app. That is not incidental: it is
// the deployment shape a consumer's own app has (a Router inside a Router, a
// memory stack inside a browser one), and it is now exercised by every visit
// rather than by the chain bench alone.
//
// Two full-height sections, the landing's own shape: what it is on one side,
// the live thing on the other. The first one fills the viewport, so the glass
// is there the moment the page is.
function PlaygroundScreen() {
  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="transparent">
      <div className="h-full overflow-y-auto">
        <BenchStage />
        <ChainStage />
      </div>
    </Screen>
  );
}

export default PlaygroundScreen;
