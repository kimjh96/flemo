"use client";

import { Screen } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/(app)/_providers/ShellIntlProvider";

// Showcase screen (skeleton). The shiflo card and the rest of the production
// app gallery migrate here from the existing /showcase page in a follow-up PR.
// This stub exists so the shell has a real second peer to slide to on the
// shared axis, proving Home <-> Showcase lateral navigation.
function ShowcaseScreen() {
  const dict = useShellDict();

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-6 py-20 lg:py-28">
          <div className="flex flex-col gap-4">
            <span className="kicker">{dict.showcase.kicker}</span>
            <h1 className="display text-[clamp(2.25rem,5vw,3.5rem)] text-[var(--color-text-primary)]">
              {dict.showcase.title}
            </h1>
            <p className="max-w-[44ch] text-lg leading-relaxed text-[var(--color-text-secondary)]">
              {dict.showcase.subtitle}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {[0, 1].map((index) => (
              <div
                key={index}
                className="flex h-48 items-center justify-center rounded-3xl border border-[var(--color-border)] bg-[var(--color-layer)]/60 text-sm font-medium text-[var(--color-text-disabled)] backdrop-blur-md"
              >
                {dict.showcase.placeholder}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}

export default ShowcaseScreen;
