import type { DiagramProps } from "../DocDiagram.types";
import CodeCard from "../CodeCard";
import MiniScreen from "../MiniScreen";

const RECIPE = ["initial  { x: 100% }", "enter    { x: 0 }", "exit     { x: -30% }"];
const KEYFRAMES = [
  "@keyframes enter {",
  "  from { translate: 100% }",
  "  to   { translate: 0 }",
  "}"
];

// A transition is a recipe of start and end styles. flemo turns it into CSS
// once, and from then on the browser plays it by itself on every push and pop.
function CompileDiagram({ id, t }: DiagramProps) {
  return (
    <>
      <CodeCard x={30} y={95} title={t.compile.recipe} lines={RECIPE} />
      <path
        d="M290 180 L 352 180"
        stroke="var(--fg-subtle)"
        strokeWidth={1.5}
        markerEnd={`url(#${id}-arrow)`}
      />
      <text x={321} y={164} textAnchor="middle" className="diagram-note">
        {t.compile.once}
      </text>
      <CodeCard x={362} y={95} title={t.compile.css} lines={KEYFRAMES} accent />
      <path
        d="M622 180 L 684 180"
        stroke="var(--fg-subtle)"
        strokeWidth={1.5}
        markerEnd={`url(#${id}-arrow)`}
      />
      <text x={653} y={164} textAnchor="middle" className="diagram-note">
        {t.compile.every}
      </text>
      <MiniScreen
        x={770}
        y={70}
        width={136}
        height={216}
        tone="accent"
        content="detail"
        glowId={id}
      />
      {[0, 1, 2].map((index) => (
        <line
          key={index}
          x1={712}
          x2={756}
          y1={120 + index * 50}
          y2={120 + index * 50}
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.5 - index * 0.12}
        />
      ))}
      <text x={838} y={318} textAnchor="middle" className="diagram-label">
        {t.compile.browser}
      </text>
    </>
  );
}

export default CompileDiagram;
