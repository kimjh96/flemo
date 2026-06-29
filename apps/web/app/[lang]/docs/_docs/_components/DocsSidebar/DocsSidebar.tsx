"use client";

import { useNavigate, usePathname } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import { getDocPages, getDocSections } from "../../_data/docPages";

// The persistent docs sidebar. It lives OUTSIDE the content <Slot>, so it stays
// put while only the page area transitions. Pages are grouped by section.
// Selecting one replaces the doc route with a vertical step (down the list moves
// down, up moves up).
function DocsSidebar() {
  const navigate = useNavigate();
  const lang = useShellLang();
  const sections = getDocSections(lang);
  const pages = getDocPages(lang);
  // Public API: the docs Router's own pathname (/docs/:slug) gives the active slug.
  const activeSlug = usePathname().split("/")[2];

  const go = (slug: string) => {
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
    <aside className="hidden w-64 shrink-0 overflow-y-auto px-3 py-12 md:block lg:py-16">
      <nav className="flex flex-col gap-7">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1.5 text-[11px] font-bold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
              {section.title}
            </p>
            {section.pages.map((page) => {
              const active = page.slug === activeSlug;
              return (
                <button
                  key={page.slug}
                  type="button"
                  onClick={() => go(page.slug)}
                  aria-current={active ? "page" : undefined}
                  className={`cursor-pointer rounded-xl px-3 py-2 text-left text-[14px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-primary)]/12 text-[var(--color-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-white/5 hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {page.title}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default DocsSidebar;
