"use client";

import { useNavigate, usePathname } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import { getDocPages, getDocSections } from "../../_data/docPages";

export interface DocsNavProps {
  // Called right before navigating, so the mobile sheet can close itself. The
  // desktop sidebar omits it and just navigates in place.
  onNavigate?: () => void;
}

// The docs navigation list, grouped by section. Shared by the desktop sidebar
// and the mobile sheet. Selecting a page replaces the doc route with a vertical
// step (down the list moves down, up moves up).
function DocsNav({ onNavigate }: DocsNavProps) {
  const navigate = useNavigate();
  const lang = useShellLang();
  const sections = getDocSections(lang);
  const pages = getDocPages(lang);
  // Public API: the docs Router's own pathname (/docs/:slug) gives the active slug.
  const activeSlug = usePathname().split("/")[2];

  const handleSelect = (slug: string) => {
    onNavigate?.();

    if (slug === activeSlug) return;

    const forward =
      pages.findIndex((page) => page.slug === slug) >
      pages.findIndex((page) => page.slug === activeSlug);

    navigate.push(
      "/docs/:slug",
      { slug },
      { transitionName: forward ? "doc-step-forward" : "doc-step-backward" }
    );
  };

  return (
    <nav className="flex flex-col gap-8">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[10px] font-bold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
            {section.title}
          </p>
          {section.pages.map((page) => {
            const active = page.slug === activeSlug;
            return (
              <button
                key={page.slug}
                type="button"
                onClick={() => handleSelect(page.slug)}
                aria-current={active ? "page" : undefined}
                className={`relative cursor-pointer rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-all ${
                  active
                    ? "bg-[var(--color-primary)]/10 pl-5 text-[var(--color-primary)] before:absolute before:top-1/2 before:left-2.5 before:size-1 before:-translate-y-1/2 before:rounded-full before:bg-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:translate-x-0.5 hover:bg-[var(--color-layer)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {page.title}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default DocsNav;
