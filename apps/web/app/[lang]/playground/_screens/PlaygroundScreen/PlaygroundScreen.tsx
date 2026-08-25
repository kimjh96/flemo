"use client";

import { Screen } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import BenchStage from "../../_components/BenchStage";
import ChainStage from "../../_components/ChainStage";

// The playground as a PEER of Home, Showcase and Docs: a screen of the shell's
// own Router rather than a page beside it.
//
// Which means the fixtures are now nested Routers inside a screen of another
// Router, on a site that is itself a flemo app. That is not incidental: it is
// the deployment shape a consumer's own app has (a Router inside a Router, a
// memory stack inside a browser one), and it is now exercised by every visit
// rather than by the chain bench alone.
function PlaygroundScreen() {
  const t = getDict(useShellLang()).playground;

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="transparent">
      <div className="h-full overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-10 px-6 pt-24 pb-20 lg:pt-28 lg:pb-28">
          <header className="flex flex-col gap-3">
            <span className="font-mono text-xs font-semibold tracking-[0.18em] text-[var(--color-text-disabled)] uppercase">
              {t.kicker}
            </span>
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
              {t.title}
            </h1>
            <p className="max-w-[64ch] text-base leading-relaxed text-[var(--color-text-secondary)]">
              {t.subtitle}
            </p>
          </header>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <BenchStage />
            <ChainStage />
          </div>

          <footer className="text-xs leading-relaxed text-[var(--color-text-disabled)]">
            {t.footer}
          </footer>
        </main>
      </div>
    </Screen>
  );
}

export default PlaygroundScreen;
