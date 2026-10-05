"use client";

import { useId, type ComponentType } from "react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import type { DiagramId } from "../../_data/docTypes";
import InlineText from "../InlineText";
import CompileDiagram from "./CompileDiagram";
import DiagramDefs from "./DiagramDefs";
import { diagramLabels } from "./DocDiagram.labels";
import type { DiagramProps } from "./DocDiagram.types";
import MorphDiagram from "./MorphDiagram";
import NestedDiagram from "./NestedDiagram";
import PushDiagram from "./PushDiagram";
import SlotDiagram from "./SlotDiagram";
import StackDiagram from "./StackDiagram";
import SwipeDiagram from "./SwipeDiagram";

const DIAGRAMS: Record<DiagramId, { view: string; Diagram: ComponentType<DiagramProps> }> = {
  stack: { view: "0 0 960 390", Diagram: StackDiagram },
  compile: { view: "0 0 960 360", Diagram: CompileDiagram },
  push: { view: "0 0 960 440", Diagram: PushDiagram },
  swipe: { view: "0 0 960 400", Diagram: SwipeDiagram },
  morph: { view: "0 0 960 390", Diagram: MorphDiagram },
  slot: { view: "0 0 960 390", Diagram: SlotDiagram },
  nested: { view: "0 0 960 380", Diagram: NestedDiagram }
};

export interface DocDiagramProps {
  diagram: DiagramId;
  caption: string;
}

// A drawn explanation on the How it works page. The picture is SVG built from
// theme tokens, so it follows light and dark mode; on a narrow screen it keeps
// its size and scrolls sideways inside the figure instead of shrinking the
// labels past reading.
function DocDiagram({ diagram, caption }: DocDiagramProps) {
  const id = useId().replace(/:/g, "");
  const t = diagramLabels(useShellLang());
  const { view, Diagram } = DIAGRAMS[diagram];

  return (
    <figure className="my-8 overflow-hidden rounded-xl border border-line">
      <div className="bg-grid overflow-x-auto bg-bg-subtle px-2 py-6">
        <svg
          viewBox={view}
          role="img"
          aria-label={caption.replace(/[`*]/g, "")}
          className="diagram mx-auto block w-full min-w-[640px]"
        >
          <DiagramDefs id={id} />
          <Diagram id={id} t={t} />
        </svg>
      </div>
      <figcaption className="border-t border-line bg-surface px-4 py-3 text-sm text-fg-muted">
        <InlineText text={caption} />
      </figcaption>
    </figure>
  );
}

export default DocDiagram;
