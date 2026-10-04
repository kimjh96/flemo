import { tint, toneColor, type Tone } from "../DocDiagram.tones";

export interface MiniScreenProps {
  x: number;
  y: number;
  width: number;
  height: number;
  tone?: Tone;
  // What the screen shows: a list of rows, or a detail page with a big picture.
  content?: "list" | "detail";
  // A title drawn in the header, when the diagram is about the header.
  title?: string;
  // Draws the title in the accent colour, the one piece that changed.
  titleAccent?: boolean;
  // Darkens the screen, the way a decorator dims the screen left behind.
  dim?: number;
  // The diagram's defs prefix; set it to paint a glow under the screen.
  glowId?: string;
  opacity?: number;
}

// One small app screen, drawn from a few rounded shapes: a header, then either
// rows or a picture with text lines. Every diagram on the How it works page is
// built from this one shape, so they read as the same object in different
// moments.
function MiniScreen({
  x,
  y,
  width,
  height,
  tone = "muted",
  content = "list",
  title,
  titleAccent,
  dim = 0,
  glowId,
  opacity = 1
}: MiniScreenProps) {
  const color = toneColor(tone);
  const pad = width * 0.08;
  const inner = width - pad * 2;
  const headerH = height * 0.1;
  const block = { fill: tint(tone, tone === "muted" ? 40 : 38) };
  const line = { fill: tint(tone, tone === "muted" ? 32 : 30) };

  const rows = [0, 1, 2, 3];
  const rowTop = y + headerH + pad * 1.4;
  const rowH = (height - headerH - pad * 2.4) / rows.length;

  return (
    <g opacity={opacity}>
      {glowId && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={width * 0.09}
          fill={color}
          opacity={0.35}
          filter={`url(#${glowId}-glow)`}
        />
      )}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={width * 0.09}
        style={{ fill: tint(tone, tone === "muted" ? 18 : 16) }}
        stroke={tone === "muted" ? "var(--line-strong)" : color}
        strokeWidth={1.5}
      />
      <rect
        x={x + pad}
        y={y + pad * 0.9}
        width={inner}
        height={headerH * 0.7}
        rx={headerH * 0.2}
        style={block}
      />
      {title && (
        <text
          x={x + width / 2}
          y={y + pad * 0.9 + headerH * 0.48}
          textAnchor="middle"
          fontSize={Math.max(12, headerH * 0.42)}
          fontWeight={600}
          fill={titleAccent ? "var(--accent)" : tone === "muted" ? "var(--fg-muted)" : color}
        >
          {title}
        </text>
      )}
      {content === "list" &&
        rows.map((row) => {
          const top = rowTop + row * rowH;
          const thumb = rowH * 0.62;
          return (
            <g key={row}>
              <rect
                x={x + pad}
                y={top}
                width={thumb}
                height={thumb}
                rx={thumb * 0.22}
                style={block}
              />
              <rect
                x={x + pad + thumb * 1.3}
                y={top + thumb * 0.14}
                width={inner * 0.5}
                height={thumb * 0.2}
                rx={thumb * 0.1}
                style={line}
              />
              <rect
                x={x + pad + thumb * 1.3}
                y={top + thumb * 0.52}
                width={inner * 0.32}
                height={thumb * 0.16}
                rx={thumb * 0.08}
                style={line}
              />
            </g>
          );
        })}
      {content === "detail" && (
        <g>
          <rect
            x={x + pad}
            y={rowTop}
            width={inner}
            height={height * 0.34}
            rx={width * 0.05}
            style={block}
          />
          {[0, 1, 2, 3].map((index) => (
            <rect
              key={index}
              x={x + pad}
              y={rowTop + height * 0.4 + index * height * 0.065}
              width={inner * [0.9, 0.75, 0.82, 0.5][index]!}
              height={height * 0.028}
              rx={height * 0.014}
              style={line}
            />
          ))}
        </g>
      )}
      {dim > 0 && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={width * 0.09}
          fill="#000"
          opacity={dim}
        />
      )}
    </g>
  );
}

export default MiniScreen;
