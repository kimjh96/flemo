import Link from "next/link";

import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { i18n } from "@/lib/i18n";

const GITHUB_URL = "https://github.com/kimjh96/flemo";

export interface HomeHeaderProps {
  lang: string;
}

function HomeHeader({ lang }: HomeHeaderProps) {
  const homeHref = lang === i18n.defaultLanguage ? "/" : `/${lang}`;
  const docsHref = lang === i18n.defaultLanguage ? "/docs" : `/${lang}/docs`;
  const playgroundHref = `/playground?lang=${lang}`;
  const otherLang = lang === "ko" ? "en" : "ko";
  const otherHref = otherLang === i18n.defaultLanguage ? "/" : `/${otherLang}`;
  const otherLabel = otherLang === "ko" ? "한국어" : "English";
  const docsLabel = lang === "ko" ? "문서" : "Docs";
  const playgroundLabel = lang === "ko" ? "플레이그라운드" : "Playground";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6">
        <Link
          href={homeHref}
          className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]"
        >
          <Logo size={26} />
          <span>flemo</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href={docsHref}
            className="rounded-full px-3 py-2 text-[14px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            {docsLabel}
          </Link>
          <Link
            href={playgroundHref}
            className="rounded-full px-3 py-2 text-[14px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            {playgroundLabel}
          </Link>
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-full px-3 py-2 text-[14px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            GitHub
          </Link>
          <ThemeToggle />
          <Link
            href={otherHref}
            className="ml-1 rounded-full bg-[var(--color-neutral-200)] px-3 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-300)]"
          >
            {otherLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default HomeHeader;
