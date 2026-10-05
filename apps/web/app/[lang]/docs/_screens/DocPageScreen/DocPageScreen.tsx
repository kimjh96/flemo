"use client";

import { useEffect, useRef, useState } from "react";

import { Screen, useParams, useStep } from "@flemo/react";

import Icon from "@/components/Icon";
import { useDict, useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { GITHUB_URL } from "@/lib/i18n";

import { renderPageMarkdown } from "../../_data/agentDocs";
import { getDocPage, getDocPages, getDocSection, pageHeadings } from "../../_data/docPages";
import type { DocBlock } from "../../_data/docTypes";
import DocBlocks from "../../_components/DocBlocks";
import DocPager from "../../_components/DocPager";
import DocsNavSheet from "../../_components/DocsNavSheet";
import { ANCHOR_EVENT, takePendingAnchor } from "../../_components/DocsSearch";
import DocsToc from "../../_components/DocsToc";
import InlineText from "../../_components/InlineText";

// Words a reader actually reads: folded details and code do not count.
function visibleWords(blocks: DocBlock[]): number {
  return blocks.reduce((count, block) => {
    switch (block.type) {
      case "p":
      case "h":
      case "h3":
      case "note":
        return count + block.text.split(/\s+/).length;
      case "list":
        return count + block.items.join(" ").split(/\s+/).length;
      case "table":
        return count + block.rows.flat().join(" ").split(/\s+/).length;
      default:
        return count;
    }
  }, 0);
}

// One doc page: a screen of the docs Router. It scrolls in its own container,
// which flemo keeps mounted under a push, so coming back restores the reader's
// place on the page.
function DocPageScreen() {
  const params = useParams<"/docs/:slug">();
  const lang = useShellLang();
  const t = useDict().docs;
  const slug = params?.slug ?? "introduction";
  const page = getDocPage(lang, slug);
  const pages = getDocPages(lang);
  const section = getDocSection(lang, slug);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  // On a phone the page list opens as a sheet through a flemo step, so the
  // system Back gesture closes it without changing the page.
  const { pushStep, popStep } = useStep<"/docs/:slug">();
  const navOpen = Boolean(params?.nav);

  // A search result that named a heading on this page.
  useEffect(() => {
    const scrollToPending = () => {
      const anchor = takePendingAnchor(slug);
      const root = scrollRef.current;
      const element = anchor ? root?.querySelector<HTMLElement>(`#${CSS.escape(anchor)}`) : null;
      if (root && element) root.scrollTo({ top: element.offsetTop - 24, behavior: "smooth" });
    };
    scrollToPending();
    window.addEventListener(ANCHOR_EVENT, scrollToPending);
    return () => window.removeEventListener(ANCHOR_EVENT, scrollToPending);
  }, [slug]);

  if (!page) return null;

  const index = pages.findIndex((item) => item.slug === slug);
  const previous = index > 0 ? pages[index - 1] : undefined;
  const next = index < pages.length - 1 ? pages[index + 1] : undefined;
  const minutes = Math.max(1, Math.round(visibleWords(page.blocks) / 220));

  const copyPage = async () => {
    await navigator.clipboard.writeText(renderPageMarkdown(lang, page));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Screen statusBarHeight="0px" systemNavigationBarHeight="0px" backgroundColor="var(--bg)">
      <div className="relative h-full">
        <div ref={scrollRef} data-testid="docs-scroll" className="h-full overflow-y-auto">
          <div className="sticky top-0 z-20 flex h-11 items-center border-b border-line bg-bg/90 px-4 backdrop-blur md:hidden">
            <button
              type="button"
              onClick={() => pushStep({ slug, nav: true })}
              className="flex items-center gap-2 text-sm text-fg-muted"
            >
              <Icon name="menu" size={16} />
              <span className="text-fg-subtle">{section?.title}</span>
              <Icon name="chevronRight" size={12} className="text-fg-subtle" />
              <span className="text-fg">{page.title}</span>
            </button>
          </div>

          <div className="mx-auto grid max-w-[1100px] gap-16 px-5 pt-10 pb-24 sm:px-8 md:pt-14 lg:px-12 xl:grid-cols-[minmax(0,1fr)_200px]">
            <article className="min-w-0 max-w-[720px]">
              <p className="label flex items-center gap-2 text-fg-subtle">
                <span aria-hidden="true" className="h-px w-4 bg-accent" />
                {section?.title}
              </p>
              <h1 className="mt-4 text-h1 text-fg">{page.title}</h1>
              <p className="mt-4 text-lead text-fg-muted">
                <InlineText text={page.summary} />
              </p>
              <div className="mt-6 flex items-center gap-4 border-b border-line pb-6 text-xs text-fg-subtle">
                <span className="font-mono">
                  {minutes} {t.minRead}
                </span>
                <button
                  type="button"
                  onClick={copyPage}
                  className="flex items-center gap-1.5 transition-colors hover:text-fg"
                >
                  <Icon
                    name={copied ? "check" : "copy"}
                    size={13}
                    className={copied ? "text-success" : ""}
                  />
                  {copied ? t.copied : t.copyPage}
                </button>
              </div>

              <div className="pt-4">
                <DocBlocks blocks={page.blocks} />
              </div>

              <DocPager
                previous={previous}
                next={next}
                labels={{ previous: t.previous, next: t.next }}
              />

              <a
                href={`${GITHUB_URL}/blob/main/apps/web/app/%5Blang%5D/docs/_data/pages/${slug}.ts`}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex items-center gap-1.5 text-xs text-fg-subtle transition-colors hover:text-fg"
              >
                <Icon name="github" size={13} />
                {t.editOnGithub}
              </a>
            </article>

            <div className="hidden xl:block">
              <div className="sticky top-10">
                <DocsToc title={t.onThisPage} headings={pageHeadings(page)} scrollRef={scrollRef} />
              </div>
            </div>
          </div>
        </div>
        <DocsNavSheet
          open={navOpen}
          title={t.title}
          onClose={() => (navOpen ? popStep() : undefined)}
        />
      </div>
    </Screen>
  );
}

export default DocPageScreen;
