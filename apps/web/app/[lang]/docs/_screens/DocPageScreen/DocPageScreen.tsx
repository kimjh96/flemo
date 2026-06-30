"use client";

import type { ReactNode } from "react";

import { Screen, useParams, useStep } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import CodeBlock from "@/components/molecules/CodeBlock";
import DocsNavSheet from "../../_components/DocsNavSheet";
import { getDocPage } from "../../_data/docPages";

// Render `inline code` segments (backtick-delimited) inside prose.
function renderInline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded-md bg-[var(--color-layer)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--color-primary)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// A single docs page. The whole right area is this screen, so it carries its own
// vertical transition when the sidebar moves between pages.
function DocPageScreen() {
  const params = useParams<"/docs/:slug">();
  const lang = useShellLang();
  const slug = params?.slug ?? "introduction";
  const page = getDocPage(lang, slug);
  // On mobile the persistent sidebar is hidden, so the doc nav opens as a sheet
  // through a flemo step (a sub-state of this /docs/:slug screen), so the Back
  // button dismisses it, the same way the playground source panel uses `code`.
  const { pushStep, popStep } = useStep<"/docs/:slug">();
  const navOpen = Boolean(params?.nav);

  const handleOpenNav = () => pushStep({ slug, nav: true });
  const handleCloseNav = () => {
    if (navOpen) popStep();
  };

  if (!page) return null;

  return (
    <Screen statusBarHeight="0px" systemNavigationBarHeight="0px" backgroundColor="var(--color-bg)">
      <div
        data-testid="docs-scroll"
        className="h-full overflow-y-auto px-6 pt-24 pb-16 lg:px-16 lg:pt-28 lg:pb-20"
      >
        <article className="mx-auto max-w-[720px]">
          <button
            type="button"
            onClick={handleOpenNav}
            className="mb-6 flex cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border-light)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {page.title}
          </button>
          <h1 className="text-[clamp(2rem,4vw,2.75rem)] font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
            {page.title}
          </h1>
          <div className="mt-8 flex flex-col gap-6">
            {page.blocks.map((block, index) => {
              if (block.type === "h") {
                return (
                  <h2
                    key={index}
                    className="mt-4 text-xl font-bold text-[var(--color-text-primary)]"
                  >
                    {block.text}
                  </h2>
                );
              }
              if (block.type === "code") {
                return <CodeBlock key={index} code={block.code} lang={block.lang} />;
              }
              if (block.type === "list") {
                return (
                  <ul key={index} className="flex flex-col gap-2.5">
                    {block.items.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="relative pl-5 text-[15px] leading-[1.7] text-[var(--color-text-secondary)] before:absolute before:top-[0.66em] before:left-0 before:size-1.5 before:rounded-full before:bg-[var(--color-primary)]"
                      >
                        {renderInline(item)}
                      </li>
                    ))}
                  </ul>
                );
              }
              if (block.type === "note") {
                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/6 px-4 py-3 text-[14px] leading-[1.7] text-[var(--color-text-secondary)]"
                  >
                    {renderInline(block.text)}
                  </div>
                );
              }
              if (block.type === "table") {
                return (
                  <div
                    key={index}
                    className="overflow-x-auto rounded-2xl border border-[var(--color-border-light)]"
                  >
                    <table className="w-full border-collapse text-left text-[14px]">
                      <thead>
                        <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-layer)]/60">
                          {block.headers.map((header, headerIndex) => (
                            <th
                              key={headerIndex}
                              className="px-4 py-2.5 font-semibold text-[var(--color-text-primary)]"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="border-b border-[var(--color-border-light)] last:border-0"
                          >
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="px-4 py-2.5 align-top leading-[1.6] text-[var(--color-text-secondary)]"
                              >
                                {renderInline(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
              return (
                <p
                  key={index}
                  className="text-[15px] leading-[1.8] text-[var(--color-text-secondary)]"
                >
                  {renderInline(block.text)}
                </p>
              );
            })}
          </div>
        </article>
      </div>
      <DocsNavSheet open={navOpen} onClose={handleCloseNav} />
    </Screen>
  );
}

export default DocPageScreen;
