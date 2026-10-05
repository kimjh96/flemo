"use client";

import { Screen } from "@flemo/react";

import { ButtonLink } from "@/components/Button";
import Icon from "@/components/Icon";
import SiteFooter from "@/app/[lang]/_components/SiteFooter";
import { useDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import ShowcaseAppCard from "./ShowcaseAppCard";
import { showcaseApps, SUBMIT_URL } from "./showcaseApps";

function ShowcaseScreen() {
  const t = useDict().showcase;

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--bg)">
      <div className="h-full overflow-y-auto pt-14">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 py-16 sm:px-6 lg:py-24">
          <div className="flex flex-col gap-4">
            <p className="label flex items-center gap-2 text-fg-subtle">
              <span aria-hidden="true" className="h-px w-4 bg-accent" />
              {t.eyebrow}
            </p>
            <h1 className="text-h1 text-fg">{t.title}</h1>
            <p className="max-w-[52ch] text-lead text-fg-muted">{t.subtitle}</p>
          </div>

          <div className="flex flex-col gap-4">
            {showcaseApps.map((app) => (
              <ShowcaseAppCard key={app.id} app={app} />
            ))}
          </div>

          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed border-line-strong p-8 sm:flex-row sm:items-center">
            <div>
              <p className="text-h3 text-fg">{t.submit.title}</p>
              <p className="text-sm text-fg-muted">{t.submit.body}</p>
            </div>
            <ButtonLink href={SUBMIT_URL} target="_blank" rel="noreferrer" variant="secondary">
              {t.submit.cta}
              <Icon name="arrowUpRight" size={14} />
            </ButtonLink>
          </div>
        </div>
        <SiteFooter />
      </div>
    </Screen>
  );
}

export default ShowcaseScreen;
