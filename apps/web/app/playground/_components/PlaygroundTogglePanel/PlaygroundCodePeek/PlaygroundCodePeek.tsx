import { tokenColor, tokenize } from "./PlaygroundCodePeek.utils";

export interface PlaygroundCodePeekProps {
  code: string;
}

function PlaygroundCodePeek({ code }: PlaygroundCodePeekProps) {
  const tokens = tokenize(code);
  return (
    <pre className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-layer)] p-4 text-[12px] leading-relaxed text-[var(--color-text-primary)]">
      <code className="font-mono">
        {tokens.map((token, index) => (
          <span key={index} style={{ color: tokenColor[token.type] }}>
            {token.value}
          </span>
        ))}
      </code>
    </pre>
  );
}

export default PlaygroundCodePeek;
