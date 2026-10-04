import type { DiagramProps } from "../DocDiagram.types";
import MiniScreen from "../MiniScreen";

const W = 180;
const H = 300;
const LEFT = { x: 70, y: 40 };
const RIGHT = { x: 710, y: 40 };

// Where MiniScreen draws its first row thumbnail and its detail picture, so the
// highlighted boxes sit exactly on the shapes underneath.
const pad = W * 0.08;
const rowTop = H * 0.1 + pad * 1.4;
const thumb = ((H - H * 0.1 - pad * 2.4) / 4) * 0.62;
const FROM = { x: LEFT.x + pad, y: LEFT.y + rowTop, w: thumb, h: thumb };
const TO = { x: RIGHT.x + pad, y: RIGHT.y + rowTop, w: W - pad * 2, h: H * 0.34 };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// The same thing on two screens. flemo measures where it is on the old screen
// and where it will be on the new one, then moves the new element from the
// first box to the second.
function MorphDiagram({ id, t }: DiagramProps) {
  const steps = [0.3, 0.55, 0.8];

  return (
    <>
      <MiniScreen x={LEFT.x} y={LEFT.y} width={W} height={H} />
      <MiniScreen x={RIGHT.x} y={RIGHT.y} width={W} height={H} content="detail" />

      <rect
        x={FROM.x}
        y={FROM.y}
        width={FROM.w}
        height={FROM.h}
        rx={8}
        fill="var(--accent)"
        opacity={0.9}
      />
      {steps.map((k) => (
        <rect
          key={k}
          x={lerp(FROM.x, TO.x, k)}
          y={lerp(FROM.y, TO.y, k) - Math.sin(k * Math.PI) * 40}
          width={lerp(FROM.w, TO.w, k)}
          height={lerp(FROM.h, TO.h, k)}
          rx={lerp(8, 14, k)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          opacity={0.25 + k * 0.5}
        />
      ))}
      <rect
        x={TO.x - 2}
        y={TO.y - 2}
        width={TO.w + 4}
        height={TO.h + 4}
        rx={16}
        fill="var(--accent)"
        opacity={0.3}
        filter={`url(#${id}-glow)`}
      />
      <rect
        x={TO.x}
        y={TO.y}
        width={TO.w}
        height={TO.h}
        rx={14}
        fill="var(--accent)"
        opacity={0.9}
      />

      <path
        d={`M${FROM.x + FROM.w} ${FROM.y + FROM.h / 2} C 340 40, 560 30, ${TO.x - 8} ${TO.y + 20}`}
        fill="none"
        stroke="var(--fg-subtle)"
        strokeDasharray="3 5"
        markerEnd={`url(#${id}-arrow)`}
      />
      <text x={FROM.x + FROM.w / 2} y={LEFT.y + H + 34} textAnchor="middle" className="diagram-tag">
        {t.morph.from}
      </text>
      <text x={RIGHT.x + W / 2} y={RIGHT.y + H + 34} textAnchor="middle" className="diagram-tag">
        {t.morph.to}
      </text>
      <text x={480} y={LEFT.y + H + 34} textAnchor="middle" className="diagram-note">
        {t.morph.measure}
      </text>
    </>
  );
}

export default MorphDiagram;
