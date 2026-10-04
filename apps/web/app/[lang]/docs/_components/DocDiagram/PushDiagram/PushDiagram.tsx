import type { DiagramProps } from "../DocDiagram.types";
import MiniScreen from "../MiniScreen";

const FRAME_W = 176;
const FRAME_H = 300;
const TOP = 62;
const XS = [24, 268, 512, 756];
const SCREEN_INSET = 8;

// One push, in four moments, on the cupertino preset:
// 1. the list is on screen;
// 2. the new screen is rendered and waits at its start position;
// 3. both screens move together: the new one slides in from the right, the
//    list moves back a little and dims;
// 4. the new screen sits on top of the stack.
function PushDiagram({ id, t }: DiagramProps) {
  const sw = FRAME_W - SCREEN_INSET * 2;
  const sh = FRAME_H - SCREEN_INSET * 2;

  return (
    <>
      {XS.map((x, index) => (
        <g key={x}>
          <clipPath id={`${id}-clip-${index}`}>
            <rect x={x + SCREEN_INSET} y={TOP + SCREEN_INSET} width={sw} height={sh} rx={18} />
          </clipPath>
          <rect
            x={x}
            y={TOP}
            width={FRAME_W}
            height={FRAME_H}
            rx={24}
            fill="var(--bg-subtle)"
            stroke="var(--line-strong)"
            strokeWidth={1.5}
          />
          <text
            x={x + FRAME_W / 2}
            y={TOP + FRAME_H + 34}
            textAnchor="middle"
            className="diagram-tag"
          >
            {`${index + 1}  ${t.push[index]}`}
          </text>
          <text
            x={x + FRAME_W / 2}
            y={TOP + FRAME_H + 56}
            textAnchor="middle"
            className="diagram-note"
          >
            {t.pushNotes[index]}
          </text>
          {index < XS.length - 1 && (
            <path
              d={`M${x + FRAME_W + 18} ${TOP + FRAME_H / 2} L ${x + FRAME_W + 50} ${TOP + FRAME_H / 2}`}
              stroke="var(--fg-subtle)"
              strokeWidth={1.5}
              markerEnd={`url(#${id}-arrow)`}
            />
          )}
        </g>
      ))}

      {/* 1: the list */}
      <g clipPath={`url(#${id}-clip-0)`}>
        <MiniScreen x={XS[0]! + SCREEN_INSET} y={TOP + SCREEN_INSET} width={sw} height={sh} />
      </g>

      {/* 2: the new screen is rendered first and waits, lifted, at its start */}
      <g clipPath={`url(#${id}-clip-1)`}>
        <MiniScreen x={XS[1]! + SCREEN_INSET} y={TOP + SCREEN_INSET} width={sw} height={sh} />
      </g>
      {[0.3, 0.55].map((dx) => (
        <line
          key={dx}
          x1={XS[1]! + 40 + dx * 100}
          x2={XS[1]! + 40 + dx * 100}
          y1={2}
          y2={TOP - 20}
          stroke="var(--accent)"
          strokeDasharray="2 4"
          opacity={0.6}
        />
      ))}
      <MiniScreen
        x={XS[1]! + 22}
        y={TOP - 30}
        width={sw - 16}
        height={sh * 0.62}
        tone="accent"
        content="detail"
        glowId={id}
      />

      {/* 3: both move together */}
      <g clipPath={`url(#${id}-clip-2)`}>
        <MiniScreen
          x={XS[2]! + SCREEN_INSET - sw * 0.3 * 0.55}
          y={TOP + SCREEN_INSET}
          width={sw}
          height={sh}
          tone="warm"
          dim={0.28}
        />
        <MiniScreen
          x={XS[2]! + SCREEN_INSET + sw * 0.45}
          y={TOP + SCREEN_INSET}
          width={sw}
          height={sh}
          tone="accent"
          content="detail"
        />
      </g>
      <path
        d={`M${XS[2]! + FRAME_W - 30} ${TOP - 18} L ${XS[2]! + 40} ${TOP - 18}`}
        stroke="var(--accent)"
        strokeWidth={1.5}
        markerEnd={`url(#${id}-arrow)`}
      />

      {/* 4: done */}
      <g clipPath={`url(#${id}-clip-3)`}>
        <MiniScreen
          x={XS[3]! + SCREEN_INSET}
          y={TOP + SCREEN_INSET}
          width={sw}
          height={sh}
          tone="accent"
          content="detail"
          glowId={id}
        />
      </g>
    </>
  );
}

export default PushDiagram;
