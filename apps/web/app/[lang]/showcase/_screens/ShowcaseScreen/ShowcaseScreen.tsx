"use client";

import { Screen } from "@flemo/react";

import ShowcaseAppCard from "./ShowcaseAppCard";
import { showcaseApps } from "./showcaseApps";
import ShowcaseSubmitCard from "./ShowcaseSubmitCard";
import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

const SUBMIT_URL = "https://github.com/kimjh96/flemo/issues/new";

// The Showcase peer: real production apps shipping flemo, laid out as a card
// grid. The showcase data and the card live next to each other so the content
// stays in one place; shiflo (the flagship) carries the "how it uses flemo" copy.
function ShowcaseScreen() {
  const lang = useShellLang();
  const t = getDict(lang).showcase;

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="transparent">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-10 px-6 pt-24 pb-20 lg:pt-28 lg:pb-28">
          <div className="flex flex-col items-start gap-4">
            <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--color-text-primary)] uppercase">
              {t.kicker}
            </span>
            <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold tracking-[-0.025em] text-[var(--color-text-primary)]">
              {t.title}
            </h1>
            <p className="max-w-[44ch] text-base leading-relaxed text-[var(--color-text-secondary)]">
              {t.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {showcaseApps.map((app) => {
              const copy = t.apps[app.id];
              return (
                <ShowcaseAppCard
                  key={app.id}
                  name={copy.name}
                  tagline={copy.tagline}
                  description={copy.description}
                  flemoUsageLabel={t.flemoUsageLabel}
                  flemoUsage={copy.flemoUsage}
                  languagesLabel={t.languagesLabel}
                  languages={app.languages.map((code) => t.languageNames[code])}
                  logo={app.logo}
                  appStore={
                    app.appStoreUrl ? { label: t.appStore, href: app.appStoreUrl } : undefined
                  }
                  playStore={
                    app.playStoreUrl ? { label: t.playStore, href: app.playStoreUrl } : undefined
                  }
                />
              );
            })}

            <ShowcaseSubmitCard
              title={t.submit.title}
              body={t.submit.body}
              cta={t.submit.cta}
              href={SUBMIT_URL}
            />
          </div>
        </div>
      </div>
    </Screen>
  );
}

export default ShowcaseScreen;
