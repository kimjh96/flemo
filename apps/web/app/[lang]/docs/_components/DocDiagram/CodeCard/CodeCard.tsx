export interface CodeCardProps {
  x: number;
  y: number;
  title: string;
  lines: string[];
  // Highlights the card as the result of a step.
  accent?: boolean;
}

// A small code panel inside a diagram: a title and a few monospaced lines.
function CodeCard({ x, y, title, lines, accent }: CodeCardProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={250}
        height={170}
        rx={16}
        fill="var(--code-bg)"
        stroke={accent ? "var(--accent)" : "var(--line-strong)"}
        strokeWidth={1.5}
      />
      <text x={x + 20} y={y + 32} className="diagram-tag" fill="var(--fg-muted)">
        {title}
      </text>
      {lines.map((line, index) => (
        <text
          key={line}
          x={x + 20}
          y={y + 70 + index * 24}
          className="diagram-code"
          fill={accent ? "var(--syntax-keyword)" : "var(--code-fg)"}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

export default CodeCard;
