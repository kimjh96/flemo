"use client";

import Link from "next/link";

import { useHistoryStore, useNavigate } from "@flemo/react";

import { useShellDict, useShellLang } from "@/app/[lang]/(app)/_providers/ShellIntlProvider";
import LanguageToggle from "@/components/LanguageToggle";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { i18n } from "@/lib/i18n";

import { SHELL_ORDER, type ShellPath } from "./SiteHeader.constants";

const GITHUB_URL = "https://github.com/kimjh96/flemo";

// The shell's persistent chrome. It lives outside the <Slot>, so it stays
// mounted while the screen below it transitions. The Home / Showcase links are
// flemo navigations within the zone (lateral shared-axis moves); Docs and
// GitHub are plain links that leave the flemo zone, so they use ordinary
// anchors, not the Router.
function SiteHeader() {
  const dict = useShellDict();
  const lang = useShellLang();
  const navigate = useNavigate();
  const currentPath = useHistoryStore((state) => state.histories[state.index]?.pathname ?? "/");
  const docsHref = lang === i18n.defaultLanguage ? "/docs" : `/${lang}/docs`;

  // Peers, not a stack: pick the slide direction from the nav order so moving
  // right slides forward and moving left slides back.
  const handleNavigate = (target: ShellPath) => {
    if (target === currentPath) return;
    const forward = SHELL_ORDER.indexOf(target) > SHELL_ORDER.indexOf(currentPath as ShellPath);
    navigate.replace(
      target,
      {},
      { transitionName: forward ? "shared-axis-forward" : "shared-axis-backward" }
    );
  };

  const shellLinks: { label: string; path: ShellPath }[] = [
    { label: dict.nav.home, path: "/" },
    { label: dict.nav.showcase, path: "/showcase" }
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)]/70 bg-[var(--color-bg)]/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6">
        <button
          type="button"
          onClick={() => handleNavigate("/")}
          className="flex cursor-pointer items-center gap-2 text-[17px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]"
        >
          <Logo size={26} />
          <span>flemo</span>
        </button>
        <nav className="flex items-center gap-1">
          <div className="hidden items-center gap-1 md:flex">
            {shellLinks.map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => handleNavigate(link.path)}
                aria-current={currentPath === link.path ? "page" : undefined}
                className={`cursor-pointer rounded-full px-3 py-2 text-[14px] font-medium transition-colors ${
                  currentPath === link.path
                    ? "text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {link.label}
              </button>
            ))}
            <Link
              href={docsHref}
              className="rounded-full px-3 py-2 text-[14px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              {dict.nav.docs}
            </Link>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-3 py-2 text-[14px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              {dict.nav.github}
            </Link>
          </div>
          <ThemeToggle />
          <LanguageToggle lang={lang} />
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
