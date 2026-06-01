import Link from "next/link";

import HomeNavMenu, { type HomeNavLink } from "./HomeNavMenu";
import LanguageToggle from "@/components/LanguageToggle";
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
  const showcaseHref = lang === i18n.defaultLanguage ? "/showcase" : `/${lang}/showcase`;

  const links: HomeNavLink[] = [
    { text: "Docs", href: docsHref },
    { text: "Playground", href: playgroundHref },
    { text: "Showcase", href: showcaseHref },
    { text: "GitHub", href: GITHUB_URL, external: true }
  ];

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
          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer" : undefined}
                className="rounded-full px-3 py-2 text-[14px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                {link.text}
              </Link>
            ))}
          </div>
          <ThemeToggle />
          <LanguageToggle lang={lang} />
          <HomeNavMenu links={links} />
        </nav>
      </div>
    </header>
  );
}

export default HomeHeader;
