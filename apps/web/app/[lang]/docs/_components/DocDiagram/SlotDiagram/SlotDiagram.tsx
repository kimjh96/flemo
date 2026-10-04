import type { DiagramProps } from "../DocDiagram.types";
import MiniScreen from "../MiniScreen";

const FRAME = { x: 40, y: 30, w: 400, h: 330 };
const HEADER_H = 46;

// Left: what sits outside a Slot stays still while only the region inside it
// moves. Right: two screens share one header, and a Part changes only the
// title on it.
function SlotDiagram({ id, t }: DiagramProps) {
  const slot = {
    x: FRAME.x + 14,
    y: FRAME.y + HEADER_H + 18,
    w: FRAME.w - 28,
    h: FRAME.h - HEADER_H - 32
  };

  return (
    <>
      <rect
        x={FRAME.x}
        y={FRAME.y}
        width={FRAME.w}
        height={FRAME.h}
        rx={20}
        fill="var(--bg-subtle)"
        stroke="var(--line-strong)"
        strokeWidth={1.5}
      />
      <rect
        x={FRAME.x + 14}
        y={FRAME.y + 12}
        width={FRAME.w - 28}
        height={HEADER_H - 8}
        rx={10}
        fill="var(--surface-3)"
      />
      <text x={FRAME.x + FRAME.w / 2} y={FRAME.y + 37} textAnchor="middle" className="diagram-note">
        {t.slot.stays}
      </text>
      <clipPath id={`${id}-slot-clip`}>
        <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} rx={12} />
      </clipPath>
      <g clipPath={`url(#${id}-slot-clip)`}>
        <MiniScreen
          x={slot.x - slot.w * 0.18}
          y={slot.y}
          width={slot.w}
          height={slot.h}
          tone="warm"
          dim={0.2}
        />
        <MiniScreen
          x={slot.x + slot.w * 0.42}
          y={slot.y}
          width={slot.w}
          height={slot.h}
          tone="accent"
          content="detail"
        />
      </g>
      <rect
        x={slot.x}
        y={slot.y}
        width={slot.w}
        height={slot.h}
        rx={12}
        fill="none"
        stroke="var(--accent)"
        strokeDasharray="5 5"
      />
      <text
        x={slot.x + 12}
        y={slot.y + slot.h + 4}
        dy={-10}
        className="diagram-tag"
        fill="var(--accent)"
      >
        {"<Slot>"}
      </text>
      <text
        x={FRAME.x + FRAME.w / 2}
        y={FRAME.y + FRAME.h + 28}
        textAnchor="middle"
        className="diagram-note"
      >
        {t.slot.moves}
      </text>

      {/* the shared header and its Part */}
      <MiniScreen x={530} y={60} width={150} height={240} title={t.slot.title1} titleAccent />
      <path
        d="M694 180 L 742 180"
        stroke="var(--fg-subtle)"
        strokeWidth={1.5}
        markerEnd={`url(#${id}-arrow)`}
      />
      <MiniScreen x={756} y={60} width={150} height={240} title={t.slot.title2} titleAccent />
      <text x={718} y={334} textAnchor="middle" className="diagram-label">
        {t.slot.part}
      </text>
    </>
  );
}

export default SlotDiagram;
