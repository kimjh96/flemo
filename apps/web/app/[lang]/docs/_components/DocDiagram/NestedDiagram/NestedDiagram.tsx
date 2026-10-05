import type { DiagramProps } from "../DocDiagram.types";
import MiniScreen from "../MiniScreen";

const OUTER = { x: 230, y: 24, w: 500, h: 340 };
const PANEL = { x: 262, y: 150, w: 436, h: 190 };

// A Router inside a screen of another Router. The inner one keeps its own
// stack and moves only inside its box; the outer one moves the whole screen.
function NestedDiagram({ id, t }: DiagramProps) {
  return (
    <>
      <rect
        x={OUTER.x}
        y={OUTER.y}
        width={OUTER.w}
        height={OUTER.h}
        rx={22}
        fill="var(--bg-subtle)"
        stroke="var(--line-strong)"
        strokeWidth={1.5}
      />
      <rect
        x={OUTER.x + 20}
        y={OUTER.y + 18}
        width={OUTER.w - 40}
        height={34}
        rx={10}
        fill="var(--surface-3)"
      />
      <rect
        x={OUTER.x + 20}
        y={OUTER.y + 66}
        width={OUTER.w * 0.5}
        height={50}
        rx={10}
        fill="var(--surface-2)"
      />
      <text x={OUTER.x} y={OUTER.y - 4} dy={-4} className="diagram-tag">
        {t.nested.outer}
      </text>

      <rect
        x={PANEL.x}
        y={PANEL.y}
        width={PANEL.w}
        height={PANEL.h}
        rx={14}
        fill="none"
        stroke="var(--accent)"
        strokeDasharray="5 5"
      />
      <text x={PANEL.x + 14} y={PANEL.y + 22} className="diagram-tag" fill="var(--accent)">
        {t.nested.inner}
      </text>
      <MiniScreen x={PANEL.x + 40} y={PANEL.y + 40} width={110} height={130} opacity={0.6} />
      <path
        d={`M${PANEL.x + 166} ${PANEL.y + 105} L ${PANEL.x + 220} ${PANEL.y + 105}`}
        stroke="var(--fg-subtle)"
        strokeWidth={1.5}
        markerEnd={`url(#${id}-arrow)`}
      />
      <MiniScreen
        x={PANEL.x + 236}
        y={PANEL.y + 40}
        width={110}
        height={130}
        tone="accent"
        content="detail"
        glowId={id}
      />
      <text x={PANEL.x + PANEL.w - 14} y={PANEL.y + 22} textAnchor="end" className="diagram-note">
        {t.nested.own}
      </text>
    </>
  );
}

export default NestedDiagram;
