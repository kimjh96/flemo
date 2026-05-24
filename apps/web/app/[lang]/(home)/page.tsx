import HomeFeatures from "./_components/HomeFeatures";
import HomeFooter from "./_components/HomeFooter";
import HomeHero from "./_components/HomeHero";
import HomeResources from "./_components/HomeResources";
import { getDict, i18n } from "@/lib/i18n";

const GITHUB_URL = "https://github.com/kimjh96/flemo";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const t = getDict(lang);
  const docsHref = lang === i18n.defaultLanguage ? "/docs" : `/${lang}/docs`;
  const playgroundHref = `/playground?lang=${lang}`;

  return (
    <main className="bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <HomeHero
        title={t.hero.title}
        ctaPrimary={{ label: t.hero.ctaPrimary, href: docsHref }}
        ctaSecondary={{ label: t.hero.ctaSecondary, href: playgroundHref }}
        lang={lang}
      />
      <HomeFeatures items={t.features} />
      <HomeResources
        kicker={t.resources.kicker}
        cards={t.resources.cards}
        docsHref={docsHref}
        githubHref={GITHUB_URL}
      />
      <HomeFooter built={t.footer.built} />
    </main>
  );
}
