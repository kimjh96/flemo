"use client";

import { useStep } from "@flemo/react";

import Icon from "@/components/Icon";
import Kbd from "@/components/Kbd";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/app/[lang]/_components/LanguageToggle";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";
import useSiteNavigate, { type SectionPath } from "@/app/[lang]/_hooks/useSiteNavigate";
import { GITHUB_URL } from "@/lib/i18n";

import { openDocsSearch } from "@/app/[lang]/docs/_components/DocsSearch";

// The persistent chrome, outside the shell's <Slot>: it stays mounted while the
// region under it moves. Screens scroll beneath it, so it carries its own
// translucent backdrop and a hairline that only reads once content is under it.
function SiteHeader() {
  const t = useShellDict();
  const { section, goSection } = useSiteNavigate();
  // The mobile menu is a flemo step, so the browser's Back button closes it.
  const { step, pushStep, popStep } = useStep<{ menu: boolean }>();
  const menuOpen = Boolean(step?.menu);

  const links: { label: string; path: SectionPath }[] = [
    { label: t.nav.docs, path: "/docs" },
    { label: t.nav.playground, path: "/playground" },
    { label: t.nav.showcase, path: "/showcase" }
  ];

  const go = async (path: SectionPath) => {
    // Close the menu (pop its step) first, so the destination is not stacked
    // on top of the open menu entry.
    if (menuOpen) await popStep();
    goSection(path);
  };

  return (
    <header className="absolute inset-x-0 top-0 z-40 border-b border-line/70 bg-bg/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-2 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => go("/")}
          aria-label={t.nav.home}
          aria-current={section === "/" ? "page" : undefined}
          className="-ml-1 flex items-center gap-2 rounded-md px-1 py-1 text-fg"
        >
          <Logo size={26} />
          <span className="text-[1.0625rem] font-semibold tracking-[-0.03em]">flemo</span>
        </button>

        <nav className="ml-6 hidden items-center gap-0.5 md:flex">
          {links.map((link) => {
            const active = section === link.path;
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => go(link.path)}
                aria-current={active ? "page" : undefined}
                className={`relative h-8 rounded-md px-3 text-sm transition-colors ${
                  active ? "text-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {link.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-[13px] h-px bg-fg"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={openDocsSearch}
            className="mr-1 hidden h-8 w-52 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted lg:flex"
          >
            <Icon name="search" size={14} />
            <span className="flex-1 text-left">{t.nav.search}</span>
            <Kbd>⌘K</Kbd>
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={t.nav.github}
            className="hidden size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:inline-flex"
          >
            <Icon name="github" size={17} />
          </a>
          <ThemeToggle />
          <LanguageToggle />
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => (menuOpen ? popStep() : pushStep({ menu: true }))}
            className="ml-0.5 inline-flex size-8 items-center justify-center rounded-md text-fg transition-colors hover:bg-surface-2 md:hidden"
          >
            <Icon name={menuOpen ? "close" : "menu"} size={18} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute inset-x-0 top-full h-[calc(100dvh-3.5rem)] border-t border-line bg-bg md:hidden">
          <nav className="flex flex-col px-4 py-3">
            {[{ label: t.nav.home, path: "/" as const }, ...links].map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => go(link.path)}
                aria-current={section === link.path ? "page" : undefined}
                className={`flex h-14 items-center justify-between border-b border-line text-left text-h3 ${
                  section === link.path ? "text-fg" : "text-fg-muted"
                }`}
              >
                {link.label}
                <Icon name="chevronRight" size={16} className="text-fg-subtle" />
              </button>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="flex h-14 items-center justify-between text-h3 text-fg-muted"
            >
              {t.nav.github}
              <Icon name="arrowUpRight" size={16} className="text-fg-subtle" />
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

export default SiteHeader;
