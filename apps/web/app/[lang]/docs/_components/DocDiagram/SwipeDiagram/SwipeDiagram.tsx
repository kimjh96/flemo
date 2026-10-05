import type { DiagramProps } from "../DocDiagram.types";
import MiniScreen from "../MiniScreen";

const FRAME = { x: 70, y: 40, w: 196, h: 320 };
const INSET = 8;
const SWIPED = 0.42;
const BAR = { x: 380, y: 150, w: 500 };

// A swipe back: the pop is already set up and paused, and the finger decides
// how far along it is. Let go past the line and it finishes going back; let
// go early and it slides back to where it was.
function SwipeDiagram({ id, t }: DiagramProps) {
  const sw = FRAME.w - INSET * 2;
  const sh = FRAME.h - INSET * 2;
  const sx = FRAME.x + INSET;
  const sy = FRAME.y + INSET;
  const edge = sx + sw * SWIPED;

  return (
    <>
      <clipPath id={`${id}-swipe-clip`}>
        <rect x={sx} y={sy} width={sw} height={sh} rx={20} />
      </clipPath>
      <rect
        x={FRAME.x}
        y={FRAME.y}
        width={FRAME.w}
        height={FRAME.h}
        rx={26}
        fill="var(--bg-subtle)"
        stroke="var(--line-strong)"
        strokeWidth={1.5}
      />
      <g clipPath={`url(#${id}-swipe-clip)`}>
        <MiniScreen
          x={sx - sw * 0.3 * (1 - SWIPED)}
          y={sy}
          width={sw}
          height={sh}
          tone="warm"
          dim={0.3 * (1 - SWIPED)}
        />
        <MiniScreen x={edge} y={sy} width={sw} height={sh} tone="accent" content="detail" />
      </g>

      {/* the finger on the edge of the top screen */}
      <circle cx={edge} cy={FRAME.y + FRAME.h / 2} r={16} fill="var(--accent)" opacity={0.18} />
      <circle cx={edge} cy={FRAME.y + FRAME.h / 2} r={7} fill="var(--accent)" />
      <path
        d={`M${edge + 16} ${FRAME.y + FRAME.h / 2} L ${edge + 70} ${FRAME.y + FRAME.h / 2}`}
        stroke="var(--accent)"
        strokeWidth={1.6}
        markerEnd={`url(#${id}-arrow)`}
      />
      <text
        x={edge}
        y={FRAME.y + FRAME.h / 2 + 40}
        textAnchor="middle"
        className="diagram-note"
        fill="var(--accent)"
      >
        {t.swipe.finger}
      </text>

      {/* progress along the pop */}
      <text x={BAR.x} y={BAR.y - 22} className="diagram-tag">
        {t.swipe.progress}
      </text>
      <rect x={BAR.x} y={BAR.y} width={BAR.w} height={10} rx={5} fill="var(--surface-3)" />
      <rect x={BAR.x} y={BAR.y} width={BAR.w * SWIPED} height={10} rx={5} fill="var(--accent)" />
      <circle cx={BAR.x + BAR.w * SWIPED} cy={BAR.y + 5} r={9} fill="var(--accent)" />
      <line
        x1={BAR.x + BAR.w * 0.5}
        x2={BAR.x + BAR.w * 0.5}
        y1={BAR.y - 10}
        y2={BAR.y + 20}
        stroke="var(--fg-subtle)"
        strokeDasharray="3 3"
      />
      <text x={BAR.x} y={BAR.y + 36} className="diagram-note">
        0
      </text>
      <text x={BAR.x + BAR.w} y={BAR.y + 36} textAnchor="end" className="diagram-note">
        100%
      </text>

      {/* the two ways a release goes */}
      <path
        d={`M${BAR.x + BAR.w * SWIPED} ${BAR.y + 26} C ${BAR.x + 300} ${BAR.y + 70}, ${BAR.x + 420} ${BAR.y + 80}, ${BAR.x + BAR.w} ${BAR.y + 90}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        markerEnd={`url(#${id}-arrow)`}
      />
      <text x={BAR.x + BAR.w} y={BAR.y + 116} textAnchor="end" className="diagram-label">
        {t.swipe.goBack}
      </text>
      <path
        d={`M${BAR.x + BAR.w * SWIPED - 6} ${BAR.y + 26} C ${BAR.x + 160} ${BAR.y + 110}, ${BAR.x + 60} ${BAR.y + 140}, ${BAR.x} ${BAR.y + 150}`}
        fill="none"
        stroke="var(--warning)"
        strokeWidth={1.5}
        strokeDasharray="4 4"
        markerEnd={`url(#${id}-arrow)`}
      />
      <text x={BAR.x} y={BAR.y + 178} className="diagram-label">
        {t.swipe.stay}
      </text>
    </>
  );
}

export default SwipeDiagram;
