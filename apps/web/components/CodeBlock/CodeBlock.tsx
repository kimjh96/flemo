"use client";

import { useState } from "react";

import Icon from "@/components/Icon";

import { TOKEN_COLOR, tokenizeCode, tokensToLines } from "./CodeBlock.utils";

export interface CodeBlockProps {
  code: string;
  lang: string;
  // Shown in the header instead of the language, e.g. "App.tsx".
  title?: string;
  // 1-based line numbers to emphasise; the rest dim slightly.
  highlight?: number[];
  // Drop the frame when the caller already owns the surface.
  bare?: boolean;
  className?: string;
}

function CodeBlock({ code, lang, title, highlight, bare, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = tokensToLines(tokenizeCode(code.replace(/\n$/, ""), lang));
  const marked = highlight && highlight.length > 0 ? new Set(highlight) : null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      className={`group relative flex min-w-0 flex-col overflow-hidden ${
        bare ? "" : "rounded-lg border border-line bg-code-bg"
      } ${className ?? ""}`}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-4">
        <span className="label text-fg-subtle">{title ?? lang}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy code"}
          className="-mr-1.5 inline-flex size-7 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Icon
            name={copied ? "check" : "copy"}
            size={14}
            className={copied ? "text-success" : ""}
          />
        </button>
      </div>
      <pre className="no-scrollbar min-h-0 flex-1 overflow-auto py-3.5 font-mono text-[0.8125rem] leading-[1.7]">
        <code className="block min-w-fit">
          {lines.map((line, index) => {
            const on = marked?.has(index + 1);
            return (
              <span
                key={index}
                className={`block px-4 ${on ? "bg-accent-soft shadow-[inset_2px_0_0_var(--accent)]" : ""} ${
                  marked && !on ? "opacity-55" : ""
                }`}
              >
                {line.length === 0
                  ? "​"
                  : line.map((token, tokenIndex) => (
                      <span key={tokenIndex} style={{ color: TOKEN_COLOR[token.type] }}>
                        {token.value}
                      </span>
                    ))}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

export default CodeBlock;
