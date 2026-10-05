"use client";

import { usePathname } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import { getDocSections } from "../../_data/docPages";
import useDocsNavigate, { slugOf } from "../../_hooks/useDocsNavigate";

export interface DocsNavListProps {
  // Runs before navigating, e.g. to close the sheet the list sits in.
  onBeforeNavigate?: () => Promise<unknown> | void;
}

// The page list, grouped by section. Shared by the desktop sidebar and the
// phone sheet so the two can never disagree.
function DocsNavList({ onBeforeNavigate }: DocsNavListProps) {
  const lang = useShellLang();
  // The sidebar lives outside the docs Router's <Slot>, so it follows the
  // Router's pathname; a pop marks its destination from the first frame.
  const pathname = usePathname();
  const go = useDocsNavigate();
  const current = slugOf(pathname);

  return (
    <div className="flex flex-col gap-7">
      {getDocSections(lang).map((section) => (
        <div key={section.title} className="flex flex-col">
          <p className="label mb-2 px-3 text-fg-subtle">{section.title}</p>
          {section.pages.map((page) => {
            const active = page.slug === current;
            return (
              <button
                key={page.slug}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={async () => {
                  await onBeforeNavigate?.();
                  go(page.slug);
                }}
                className={`relative h-8 rounded-md px-3 text-left text-sm transition-colors ${
                  active
                    ? "bg-surface-2 font-medium text-fg"
                    : "text-fg-muted hover:bg-surface-2/60 hover:text-fg"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-accent"
                  />
                )}
                {page.title}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default DocsNavList;
