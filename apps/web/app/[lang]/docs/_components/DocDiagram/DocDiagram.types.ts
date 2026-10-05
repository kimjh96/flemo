import type { DiagramLabels } from "./DocDiagram.labels";

export interface DiagramProps {
  // Prefix from useId for the diagram's filter, marker and clip ids.
  id: string;
  t: DiagramLabels;
}
