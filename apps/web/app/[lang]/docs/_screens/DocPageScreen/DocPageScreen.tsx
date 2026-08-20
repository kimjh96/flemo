"use client";

import type { ReactNode } from "react";

import { Screen, useNavigate, useParams, useStep } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import CodeBlock from "@/components/molecules/CodeBlock";
import DocsNavSheet from "../../_components/DocsNavSheet";
import { getDocPage, getDocPages, getDocSection } from "../../_data/docPages";

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
  const pages = getDocPages(lang);
  const section = getDocSection(lang, slug);
  const navigate = useNavigate();
  // On mobile the persistent sidebar is hidden, so the doc nav opens as a sheet
  // through a flemo step (a sub-state of this /docs/:slug screen), so the Back
  // button dismisses it without changing the current document route.
  const { pushStep, popStep } = useStep<"/docs/:slug">();
  const navOpen = Boolean(params?.nav);

  const handleOpenNav = () => pushStep({ slug, nav: true });
  const handleCloseNav = () => {
    if (navOpen) popStep();
  };

  if (!page) return null;

  const pageIndex = pages.findIndex((item) => item.slug === slug);
  const previous = pageIndex > 0 ? pages[pageIndex - 1] : undefined;
  const next = pageIndex < pages.length - 1 ? pages[pageIndex + 1] : undefined;
  const leadIndex = page.blocks.findIndex((block) => block.type === "p");
  const lead = leadIndex >= 0 ? page.blocks[leadIndex] : undefined;
  const headings = page.blocks.flatMap((block, index) =>
    block.type === "h" ? [{ ...block, index }] : []
  );
  const readingMinutes = Math.max(
    2,
    Math.round(
      page.blocks.reduce((length, block) => {
        if (block.type === "code") return length + block.code.length * 0.35;
        if (block.type === "list") return length + block.items.join(" ").length;
        if (block.type === "table") return length + block.rows.flat().join(" ").length;
        return length + block.text.length;
      }, 0) / 750
    )
  );

  const handlePageMove = (targetSlug: string, forward: boolean) => {
    navigate.push(
      "/docs/:slug",
      { slug: targetSlug },
      { transitionName: forward ? "doc-step-forward" : "doc-step-backward" }
    );
  };

  return (
    <Screen statusBarHeight="0px" systemNavigationBarHeight="0px" backgroundColor="var(--color-bg)">
      <div
        data-testid="docs-scroll"
        className="h-full overflow-y-auto px-5 pt-24 pb-16 sm:px-8 lg:px-12 lg:pt-28 lg:pb-20"
      >
        <div className="mx-auto grid max-w-[920px] gap-14 xl:grid-cols-[minmax(0,680px)_180px]">
          <article className="min-w-0">
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
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.1em] uppercase">
              <span className="text-[var(--color-primary)]">Docs</span>
              <span className="text-[var(--color-text-disabled)]">/</span>
              <span className="text-[var(--color-text-disabled)]">{section?.title}</span>
            </div>
            <h1 className="mt-4 text-[clamp(2.35rem,5vw,3.6rem)] leading-[1.04] font-extrabold tracking-[-0.04em] text-[var(--color-text-primary)]">
              {page.title}
            </h1>
            {lead?.type === "p" ? (
              <p className="mt-5 max-w-2xl text-[18px] leading-[1.7] font-medium tracking-[-0.015em] text-[var(--color-text-secondary)] sm:text-[20px]">
                {renderInline(lead.text)}
              </p>
            ) : null}
            <div className="mt-6 flex items-center gap-3 border-b border-[var(--color-border-light)] pb-6 text-[11px] font-semibold text-[var(--color-text-disabled)]">
              <span className="rounded-full bg-[var(--color-layer)] px-2.5 py-1.5">
                {lang === "ko" ? `약 ${readingMinutes}분` : `${readingMinutes} min read`}
              </span>
              <span>
                {lang === "ko" ? `섹션 ${headings.length}개` : `${headings.length} sections`}
              </span>
            </div>

            <div className="mt-9 flex flex-col gap-6">
              {page.blocks.map((block, index) => {
                if (index === leadIndex) return null;
                if (block.type === "h") {
                  return (
                    <h2
                      key={index}
                      id={`section-${index}`}
                      className="scroll-mt-8 pt-7 text-[1.45rem] leading-tight font-extrabold tracking-[-0.025em] text-[var(--color-text-primary)] first:pt-0"
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
                    <ul key={index} className="flex flex-col gap-2.5 pl-1">
                      {block.items.map((item, itemIndex) => (
                        <li
                          key={itemIndex}
                          className="relative pl-5 text-[15px] leading-[1.75] text-[var(--color-text-secondary)] before:absolute before:top-[0.74em] before:left-0 before:h-px before:w-2 before:bg-[var(--color-text-disabled)]"
                        >
                          {renderInline(item)}
                        </li>
                      ))}
                    </ul>
                  );
                }
                if (block.type === "note") {
                  return (
                    <aside
                      key={index}
                      className="border-l-2 border-[var(--color-border-dark)] py-0.5 pl-4 text-[14px] leading-[1.8] text-[var(--color-text-secondary)]"
                    >
                      <span className="mr-2 font-bold text-[var(--color-text-primary)]">
                        {lang === "ko" ? "참고" : "Note"}
                      </span>
                      {renderInline(block.text)}
                    </aside>
                  );
                }
                if (block.type === "table") {
                  return (
                    <div
                      key={index}
                      className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]"
                    >
                      <table className="w-full border-collapse text-left text-[14px]">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] bg-[var(--color-layer)]/80">
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
                              className="border-b border-[var(--color-border-light)] even:bg-[var(--color-layer)]/25 last:border-0"
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
                    className="text-[16px] leading-[1.85] tracking-[-0.006em] text-[var(--color-text-secondary)]"
                  >
                    {renderInline(block.text)}
                  </p>
                );
              })}
            </div>

            <nav className="mt-16 grid grid-cols-2 gap-3 border-t border-[var(--color-border-light)] pt-6">
              {previous ? (
                <button
                  type="button"
                  onClick={() => handlePageMove(previous.slug, false)}
                  className="group cursor-pointer rounded-2xl border border-[var(--color-border)] p-4 text-left transition-colors hover:bg-[var(--color-layer)]"
                >
                  <span className="text-[10px] font-bold tracking-[0.08em] text-[var(--color-text-disabled)] uppercase">
                    ← {lang === "ko" ? "이전" : "Previous"}
                  </span>
                  <span className="mt-1 block text-[13px] font-bold text-[var(--color-text-primary)]">
                    {previous.title}
                  </span>
                </button>
              ) : (
                <span />
              )}
              {next ? (
                <button
                  type="button"
                  onClick={() => handlePageMove(next.slug, true)}
                  className="group cursor-pointer rounded-2xl border border-[var(--color-border)] p-4 text-right transition-colors hover:bg-[var(--color-layer)]"
                >
                  <span className="text-[10px] font-bold tracking-[0.08em] text-[var(--color-text-disabled)] uppercase">
                    {lang === "ko" ? "다음" : "Next"} →
                  </span>
                  <span className="mt-1 block text-[13px] font-bold text-[var(--color-text-primary)]">
                    {next.title}
                  </span>
                </button>
              ) : null}
            </nav>
          </article>

          {headings.length > 0 ? (
            <aside className="sticky top-8 hidden self-start xl:block">
              <p className="text-[10px] font-bold tracking-[0.1em] text-[var(--color-text-disabled)] uppercase">
                {lang === "ko" ? "이 페이지에서" : "On this page"}
              </p>
              <nav className="mt-3 flex flex-col border-l border-[var(--color-border)]">
                {headings.map((heading) => (
                  <a
                    key={heading.index}
                    href={`#section-${heading.index}`}
                    className="-ml-px border-l border-transparent py-1.5 pl-3 text-[12px] leading-snug text-[var(--color-text-disabled)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-text-primary)]"
                  >
                    {heading.text}
                  </a>
                ))}
              </nav>
            </aside>
          ) : null}
        </div>
      </div>
      <DocsNavSheet open={navOpen} onClose={handleCloseNav} />
    </Screen>
  );
}

export default DocPageScreen;
