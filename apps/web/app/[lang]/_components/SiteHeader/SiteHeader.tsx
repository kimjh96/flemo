"use client";

import Link from "next/link";

import { useNavigate, usePathname, useStep } from "@flemo/react";

import {
  useShellDict,
  useShellLang,
  useToggleShellLang
} from "@/app/[lang]/_providers/ShellIntlProvider";
import LanguageToggle from "@/components/atoms/LanguageToggle";
import Logo from "@/components/atoms/Logo";
import ThemeToggle from "@/components/atoms/ThemeToggle";

import { SHELL_ORDER, type ShellPath } from "./SiteHeader.constants";

const GITHUB_URL = "https://github.com/kimjh96/flemo";

// The shell's persistent chrome, outside the <Slot>. The nav highlights the
// active path (from flemo's public usePathname) and each menu owns its entry
// transition.
function SiteHeader() {
  const dict = useShellDict();
  const lang = useShellLang();
  const navigate = useNavigate();
  const toggleLang = useToggleShellLang();
  // Public API: the current pathname drives the nav highlight + direction.
  const activePath = usePathname();
  // The mobile menu is a flemo step (history-backed), so the Back button closes
  // it. The header is chrome outside the <Slot> (no <Screen>), so useStep keeps
  // the current path and reports the open state reactively.
  const { step, pushStep, popStep } = useStep<{ menu: boolean }>();
  const mobileOpen = Boolean(step?.menu);

  // Prefix match so a composed sub-page (deep link / refresh) keeps its menu
  // active: /docs/router -> Docs. Home stays exact.
  const isActivePath = (path: ShellPath) =>
    path === "/" ? activePath === "/" : activePath === path || activePath.startsWith(`${path}/`);

  const toggleMobile = () => {
    if (mobileOpen) popStep();
    else pushStep({ menu: true });
  };

  const handleMobileLink = async (onClick: () => void) => {
    // Close the menu (pop its step) before navigating, so the destination isn't
    // stacked on top of the open menu entry.
    if (mobileOpen) await popStep();
    onClick();
  };

  const handleGithubClick = () => {
    if (mobileOpen) popStep();
  };
  // Home and Showcase are ordered peers, so they share one directional handler
  // (a shared-axis that slides left or right by nav order). Docs owns a fixed
  // entry transition. Every handler is idempotent.
  const goPeer = (target: ShellPath) => {
    if (activePath === target) return;
    const forward = SHELL_ORDER.indexOf(target) > SHELL_ORDER.indexOf(activePath as ShellPath);
    navigate.push(
      target,
      {},
      { transitionName: forward ? "shared-axis-forward" : "shared-axis-backward" }
    );
  };

  const goHome = () => goPeer("/");
  const goShowcase = () => goPeer("/showcase");
  const goPlayground = () => goPeer("/playground");

  const goDocs = () => {
    if (activePath === "/docs") return;
    navigate.push("/docs", {}, { transitionName: "docs-enter" });
  };

  const shellLinks: { label: string; path: ShellPath; onClick: () => void }[] = [
    { label: dict.nav.home, path: "/", onClick: goHome },
    { label: dict.nav.showcase, path: "/showcase", onClick: goShowcase },
    { label: dict.nav.playground, path: "/playground", onClick: goPlayground },
    { label: dict.nav.docs, path: "/docs", onClick: goDocs }
  ];

  return (
    <header className="absolute inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/90 px-4 shadow-[0_16px_44px_-28px_rgba(18,38,70,0.48)] backdrop-blur-xl sm:px-6">
        <button
          type="button"
          onClick={goHome}
          className="flex cursor-pointer items-center gap-2 text-[17px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]"
        >
          <Logo size={26} />
          <span>flemo</span>
        </button>
        <nav className="flex items-center gap-1">
          <div className="hidden items-center gap-1 md:flex">
            {shellLinks.map((link) => {
              const active = isActivePath(link.path);
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={link.onClick}
                  aria-current={active ? "page" : undefined}
                  className={`cursor-pointer rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors ${
                    link.path === "/docs"
                      ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                      : active
                        ? "bg-[var(--color-layer)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-layer)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
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
          <LanguageToggle lang={lang} onToggle={toggleLang} />
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={toggleMobile}
            className="ml-1 grid size-9 cursor-pointer place-items-center rounded-full text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-layer)] md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d={mobileOpen ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </nav>
      </div>
      {/* Keep the menu mounted through closing so its height can animate. */}
      <div
        inert={!mobileOpen}
        className={`mx-auto mt-2 max-w-[1200px] overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-bg)]/95 shadow-[0_18px_40px_-24px_rgba(18,38,70,0.45)] backdrop-blur-xl transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] md:hidden ${
          mobileOpen ? "max-h-[420px] opacity-100" : "max-h-0 border-transparent opacity-0"
        }`}
      >
        <nav className="mx-auto flex max-w-[1240px] flex-col gap-0.5 px-4 py-3">
          {shellLinks.map((link) => {
            const active = isActivePath(link.path);
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => handleMobileLink(link.onClick)}
                aria-current={active ? "page" : undefined}
                className={`cursor-pointer rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition-colors ${
                  active
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-layer)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {link.label}
              </button>
            );
          })}
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            onClick={handleGithubClick}
            className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-layer)] hover:text-[var(--color-text-primary)]"
          >
            {dict.nav.github}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
