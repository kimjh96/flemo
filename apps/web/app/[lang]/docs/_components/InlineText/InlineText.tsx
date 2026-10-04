"use client";

import type { ReactNode } from "react";

import useDocsNavigate from "../../_hooks/useDocsNavigate";

// `code`, **strong**, [label](slug) and [label](https://...). Nothing else is
// markup, so prose can never be misread as it.
const PATTERN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;

export interface InlineTextProps {
  text: string;
}

function InlineText({ text }: InlineTextProps) {
  const go = useDocsNavigate();
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  PATTERN.lastIndex = 0;

  while ((match = PATTERN.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const [token] = match;
    const key = match.index;
    if (match[1]) {
      nodes.push(
        <code
          key={key}
          className="rounded-xs border border-line bg-surface-2 px-1 py-px font-mono text-[0.86em] text-fg"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (match[2]) {
      nodes.push(
        <strong key={key} className="font-semibold text-fg">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      const label = token.slice(1, token.indexOf("]("));
      const target = token.slice(token.indexOf("](") + 2, -1);
      const style =
        "font-medium text-fg underline decoration-line-strong underline-offset-[3px] transition-colors hover:decoration-accent";
      nodes.push(
        /^https?:\/\//.test(target) ? (
          <a key={key} href={target} target="_blank" rel="noreferrer" className={style}>
            {label}
          </a>
        ) : (
          <button key={key} type="button" onClick={() => go(target)} className={`inline ${style}`}>
            {label}
          </button>
        )
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <>{nodes}</>;
}

export default InlineText;
