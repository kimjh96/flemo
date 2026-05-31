import ShowcaseAppCard from "./_components/ShowcaseAppCard";
import ShowcasePageHeader from "./_components/ShowcasePageHeader";
import { showcaseApps } from "./_data/showcaseApps";
import { getDict } from "@/lib/i18n";

export const metadata = {
  title: "Showcase",
  description: "Real apps built with flemo, shipping in production."
};

export default async function ShowcasePage({ params }: PageProps<"/[lang]/showcase">) {
  const { lang } = await params;
  const t = getDict(lang).showcase;

  return (
    <main className="bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <ShowcasePageHeader title={t.title} subtitle={t.subtitle} />
      <section className="bg-[var(--color-bg)]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-6 py-16 sm:py-20">
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
                screenshots={app.screenshots.map((src, index) => ({
                  src,
                  alt: `${copy.name} ${index + 1}`
                }))}
                appStore={
                  app.appStoreUrl ? { label: t.appStore, href: app.appStoreUrl } : undefined
                }
                playStore={
                  app.playStoreUrl ? { label: t.playStore, href: app.playStoreUrl } : undefined
                }
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
