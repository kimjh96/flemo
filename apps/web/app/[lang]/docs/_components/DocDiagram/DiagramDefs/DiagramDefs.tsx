export interface DiagramDefsProps {
  // Prefix from useId, so two diagrams on one page never share a filter id.
  id: string;
}

// Shared SVG definitions: a soft glow for the screen that is moving, and the
// arrow head every diagram uses between its steps.
function DiagramDefs({ id }: DiagramDefsProps) {
  return (
    <defs>
      <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
      <marker
        id={`${id}-arrow`}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M1 1 L8 5 L1 9" fill="none" stroke="var(--fg-subtle)" strokeWidth="1.4" />
      </marker>
    </defs>
  );
}

export default DiagramDefs;
