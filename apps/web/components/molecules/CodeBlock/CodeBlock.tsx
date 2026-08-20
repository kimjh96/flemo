"use client";

import { useState } from "react";

import { TOKEN_COLOR, tokenizeCode } from "./CodeBlock.utils";

export interface CodeBlockProps {
  code: string;
  lang: string;
  // Lets a caller bound the box when it sits inside a fixed-height surface.
  // Scrolling happens on the inner <pre>, so the rounded, overflow-hidden box
  // clips the scrollbars to its radius instead of letting them square a corner.
  className?: string;
  // Drop the box chrome (border, glass background, radius) so the code sits flush
  // on a surface the caller already owns.
  bare?: boolean;
}

// A glass code panel with lightweight syntax highlighting (see CodeBlock.utils).
// The language tag sits top-right. Natural height in prose; when given a bounded
// height it fills it and the code scrolls within the rounded frame.
function CodeBlock({ code, lang, className, bare }: CodeBlockProps) {
  const tokens = tokenizeCode(code, lang);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={`group relative flex flex-col overflow-hidden ${
        bare ? "" : "rounded-2xl border border-white/10 bg-[var(--color-layer)]/70 backdrop-blur-md"
      } ${className ?? ""}`}
    >
      {bare ? (
        <span className="absolute top-2.5 right-3 z-10 text-[11px] font-medium tracking-wide text-[var(--color-text-disabled)] select-none">
          {lang}
        </span>
      ) : (
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-border)]/60 px-4">
          <span className="font-mono text-[10px] font-bold tracking-[0.08em] text-[var(--color-text-disabled)] uppercase">
            {lang}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]"
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m5 12 4 4L19 6"
                  stroke="var(--color-success)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="8"
                  y="8"
                  width="11"
                  height="11"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre
        className={`min-h-0 flex-1 overflow-auto px-4 text-[13px] leading-[1.75] ${bare ? "py-4" : "py-5"}`}
      >
        <code className="font-mono">
          {tokens.map((token, index) => (
            <span key={index} style={{ color: TOKEN_COLOR[token.type] }}>
              {token.value}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

export default CodeBlock;
