import Image from "next/image";

import { ButtonLink } from "@/components/Button";
import Icon from "@/components/Icon";
import { useDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import type { ShowcaseAppConfig } from "../showcaseApps";

export interface ShowcaseAppCardProps {
  app: ShowcaseAppConfig;
}

function ShowcaseAppCard({ app }: ShowcaseAppCardProps) {
  const t = useDict().showcase;
  const copy = t.apps[app.id];

  return (
    <article className="grid overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6 p-8">
        <div className="flex items-center gap-4">
          <Image
            src={app.logo}
            alt=""
            width={56}
            height={56}
            className="rounded-lg border border-line"
          />
          <div>
            <h2 className="text-h2 text-fg">{copy.name}</h2>
            <p className="text-sm text-fg-subtle">{copy.tagline}</p>
          </div>
        </div>
        <p className="text-body text-fg-muted">{copy.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {app.webUrl && (
            <ButtonLink href={app.webUrl} target="_blank" rel="noreferrer" size="sm">
              {t.web}
              <Icon name="arrowUpRight" size={13} />
            </ButtonLink>
          )}
          {app.appStoreUrl && (
            <ButtonLink
              href={app.appStoreUrl}
              target="_blank"
              rel="noreferrer"
              size="sm"
              variant="secondary"
            >
              {t.appStore}
              <Icon name="arrowUpRight" size={13} />
            </ButtonLink>
          )}
          {app.playStoreUrl && (
            <ButtonLink
              href={app.playStoreUrl}
              target="_blank"
              rel="noreferrer"
              size="sm"
              variant="secondary"
            >
              {t.playStore}
              <Icon name="arrowUpRight" size={13} />
            </ButtonLink>
          )}
          <span className="label ml-auto text-fg-subtle">
            {t.languagesLabel} · {app.languages.map((code) => t.languageNames[code]).join(", ")}
          </span>
        </div>
      </div>
      <div className="bg-grid flex flex-col justify-center gap-3 border-t border-line bg-bg-subtle p-8 lg:border-t-0 lg:border-l">
        <p className="label text-accent">{t.flemoUsageLabel}</p>
        <p className="text-body text-fg">{copy.flemoUsage}</p>
      </div>
    </article>
  );
}

export default ShowcaseAppCard;
