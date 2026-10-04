import type { DiagramProps } from "../DocDiagram.types";
import MiniScreen from "../MiniScreen";

const W = 132;
const H = 210;

// Screens are cards in a pile. push lays a new card on top; pop lifts the top
// card off. The Router is the hand that keeps the pile.
function StackDiagram({ id, t }: DiagramProps) {
  return (
    <>
      {/* the pile */}
      <MiniScreen x={404} y={88} width={W} height={H} opacity={0.45} />
      <MiniScreen x={418} y={104} width={W} height={H} opacity={0.75} />
      <MiniScreen x={432} y={120} width={W} height={H} />
      <text x={498} y={364} textAnchor="middle" className="diagram-label">
        {t.stack.stack}
      </text>

      {/* push: a new card comes down onto the pile */}
      <MiniScreen x={120} y={52} width={W} height={H} tone="accent" content="detail" glowId={id} />
      <path
        d="M262 150 C 330 120, 380 130, 424 168"
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.6}
        markerEnd={`url(#${id}-arrow)`}
      />
      <text x={186} y={296} textAnchor="middle" className="diagram-tag" fill="var(--accent)">
        {t.stack.push}
      </text>

      {/* pop: the top card lifts off */}
      <path
        d="M572 200 C 620 170, 650 160, 700 158"
        fill="none"
        stroke="var(--warning)"
        strokeWidth={1.6}
        strokeDasharray="4 4"
        markerEnd={`url(#${id}-arrow)`}
      />
      <MiniScreen x={712} y={64} width={W} height={H} tone="warm" content="detail" opacity={0.85} />
      <text x={778} y={308} textAnchor="middle" className="diagram-tag" fill="var(--warning)">
        {t.stack.pop}
      </text>
    </>
  );
}

export default StackDiagram;
