"use client";

import Icon from "@/components/Icon";

import type { DocPage } from "../../_data/docTypes";
import useDocsNavigate from "../../_hooks/useDocsNavigate";

export interface DocPagerProps {
  previous?: DocPage;
  next?: DocPage;
  labels: { previous: string; next: string };
}

function DocPager({ previous, next, labels }: DocPagerProps) {
  const go = useDocsNavigate();
  const card =
    "group flex flex-1 flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong";

  return (
    <div className="mt-16 flex flex-col gap-3 sm:flex-row">
      {previous ? (
        <button type="button" onClick={() => go(previous.slug)} className={`${card} text-left`}>
          <span className="label flex items-center gap-1 text-fg-subtle">
            <Icon name="arrowLeft" size={12} />
            {labels.previous}
          </span>
          <span className="text-body font-medium text-fg">{previous.title}</span>
        </button>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
      {next ? (
        <button
          type="button"
          onClick={() => go(next.slug)}
          className={`${card} items-end text-right`}
        >
          <span className="label flex items-center gap-1 text-fg-subtle">
            {labels.next}
            <Icon name="arrowRight" size={12} />
          </span>
          <span className="text-body font-medium text-fg">{next.title}</span>
        </button>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
    </div>
  );
}

export default DocPager;
