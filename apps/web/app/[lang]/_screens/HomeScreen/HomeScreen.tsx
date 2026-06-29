"use client";

import Link from "next/link";

import { Screen, useNavigate, useScreen } from "@flemo/react";

import { useShellDict, useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { i18n } from "@/lib/i18n";

import PlaygroundDemo from "../../_home/PlaygroundDemo";

// Landing hero: a bold black headline and pill CTAs on the left, and on the
// right the live flemo demo inside a glass window floating on a colorful blob.
// The demo auto-runs its shared-axis transition so flemo's motion sells itself.
// The screen scrolls inside the <Slot> while the header stays pinned; the
// shared-axis slide carries the whole region to Showcase.
function HomeScreen() {
  const dict = useShellDict();
  const lang = useShellLang();
  const navigate = useNavigate();
  // Only animate the demo while this screen is the active one. When it's frozen
  // under a pushed screen, a navigate from the demo's nested Router would never
  // resolve (its frozen screen never fires animationend), wedging the shared
  // task queue and freezing all navigation.
  const { isActive } = useScreen();
  const docsHref = lang === i18n.defaultLanguage ? "/docs" : `/${lang}/docs`;

  const handleOpenPlayground = () =>
    navigate.push("/playground", {}, { transitionName: "page-shove-forward" });

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <div className="h-full overflow-y-auto">
        <div className="flex min-h-full items-center">
          <div className="mx-auto grid w-full max-w-[1180px] items-center gap-12 px-6 pt-24 pb-16 lg:grid-cols-[1fr_0.95fr] lg:gap-10 lg:pt-28 lg:pb-20">
            <div className="flex flex-col items-start gap-6">
              <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--color-text-primary)] uppercase">
                {dict.home.kicker}
              </span>
              <h1 className="text-[clamp(2.5rem,5.5vw,4rem)] leading-[1.05] font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
                {dict.home.title}
              </h1>
              <p className="max-w-[42ch] text-base leading-relaxed text-[var(--color-text-secondary)]">
                {dict.home.subtitle}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href={docsHref}
                  className="inline-flex h-14 items-center rounded-full bg-[var(--color-primary)] px-7 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
                >
                  {dict.home.ctaPrimary}
                </Link>
                <button
                  type="button"
                  onClick={handleOpenPlayground}
                  className="inline-flex h-14 cursor-pointer items-center rounded-full border border-[var(--color-border-dark)] px-7 text-[15px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-layer)]"
                >
                  {dict.home.ctaSecondary}
                </button>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <PlaygroundDemo active={isActive} />
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

export default HomeScreen;
