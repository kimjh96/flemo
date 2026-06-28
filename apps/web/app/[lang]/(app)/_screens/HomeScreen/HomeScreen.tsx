"use client";

import Link from "next/link";

import { Screen } from "@flemo/react";

import ShifloDemo from "@/app/[lang]/(app)/_phone/ShifloDemo";
import { useShellDict, useShellLang } from "@/app/[lang]/(app)/_providers/ShellIntlProvider";
import { i18n } from "@/lib/i18n";

// Landing screen. The hero pairs the pitch with the live shiflo viewer (a nested
// <Router> sliding real shiflo screenshots). The features grid and the
// "author anything" transition gallery arrive in follow-up PRs. The screen
// scrolls inside the <Slot> while the header stays pinned, and the shared-axis
// slide carries this whole region when moving to Showcase.
function HomeScreen() {
  const dict = useShellDict();
  const lang = useShellLang();
  const docsHref = lang === i18n.defaultLanguage ? "/docs" : `/${lang}/docs`;
  const playgroundHref = `/playground?lang=${lang}`;

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="flex flex-col gap-6">
            <span className="kicker">{dict.home.kicker}</span>
            <h1 className="display text-[clamp(2.5rem,6vw,4.25rem)] text-[var(--color-text-primary)]">
              {dict.home.title}
            </h1>
            <p className="max-w-[34ch] text-lg leading-relaxed text-[var(--color-text-secondary)]">
              {dict.home.subtitle}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link href={docsHref} className="cta-pill">
                {dict.home.ctaPrimary}
              </Link>
              <Link href={playgroundHref} className="cta-ghost">
                {dict.home.ctaSecondary}
              </Link>
            </div>
          </div>

          {/* The live shiflo viewer: a nested <Router> sliding real shiflo
              screenshots on the shared axis. flemo carrying shiflo, shown rather
              than told. */}
          <div className="flex justify-center lg:justify-end">
            <ShifloDemo />
          </div>
        </div>
      </div>
    </Screen>
  );
}

export default HomeScreen;
