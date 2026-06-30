import { TOKEN_COLOR, tokenizeCode } from "./CodeBlock.utils";

export interface CodeBlockProps {
  code: string;
  lang: string;
  // Lets a caller bound the box (e.g. `h-full` in the playground source panel).
  // Scrolling happens on the inner <pre>, so the rounded, overflow-hidden box
  // clips the scrollbars to its radius instead of letting them square a corner.
  className?: string;
  // Drop the box chrome (border, glass background, radius) so the code sits flush
  // on a surface the caller already owns, e.g. the playground source panel.
  bare?: boolean;
}

// A glass code panel with lightweight syntax highlighting (see CodeBlock.utils).
// The language tag sits top-right. Natural height in prose; when given a bounded
// height it fills it and the code scrolls within the rounded frame.
function CodeBlock({ code, lang, className, bare }: CodeBlockProps) {
  const tokens = tokenizeCode(code, lang);

  return (
    <div
      className={`group relative flex flex-col overflow-hidden ${
        bare ? "" : "rounded-2xl border border-white/10 bg-[var(--color-layer)]/70 backdrop-blur-md"
      } ${className ?? ""}`}
    >
      <span className="absolute top-2.5 right-3 z-10 text-[11px] font-medium tracking-wide text-[var(--color-text-disabled)] select-none">
        {lang}
      </span>
      <pre className="min-h-0 flex-1 overflow-auto px-4 py-4 text-[13px] leading-relaxed">
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
