"use client";

import { Screen } from "@flemo/react";

import BenchStage from "../../_components/BenchStage";
import ChainStage from "../../_components/ChainStage";

// The playground as a PEER of Home, Showcase and Docs — a screen of the shell's
// own Router rather than a page beside it.
//
// Which means the fixtures are now nested Routers inside a screen of another
// Router, on a site that is itself a flemo app. That is not incidental: it is
// the deployment shape a consumer's own app has (a Router inside a Router, a
// memory stack inside a browser one), and it is now exercised by every visit
// rather than by the chain bench alone.
function PlaygroundScreen() {
  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="transparent">
      <div className="h-full overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-10 px-6 pt-24 pb-20 lg:pt-28 lg:pb-28">
          <header className="flex flex-col gap-3">
            <span className="font-mono text-xs font-semibold tracking-[0.18em] text-[var(--color-text-disabled)] uppercase">
              playground
            </span>
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
              Every transition, on glass
            </h1>
            <p className="max-w-[64ch] text-base leading-relaxed text-[var(--color-text-secondary)]">
              The built-in presets, four transitions written the way a consumer writes them, and a
              shared element that can be switched on over any of them. Nothing in the fixtures is
              told which transition is running.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <BenchStage />
            <ChainStage />
          </div>

          <footer className="text-xs leading-relaxed text-[var(--color-text-disabled)]">
            Judge on a production build, with devtools closed. Arm{" "}
            <code className="font-mono">?flemo:morph=on</code> to record every flight decision on{" "}
            <code className="font-mono">globalThis.flemoMorphTrace</code>.
          </footer>
        </main>
      </div>
    </Screen>
  );
}

export default PlaygroundScreen;
