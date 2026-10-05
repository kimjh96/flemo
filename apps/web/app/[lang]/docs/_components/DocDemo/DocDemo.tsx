"use client";

import MiniDemo from "@/app/[lang]/_components/MiniDemo";
import TripDemo from "@/app/[lang]/_components/TripDemo";
import type { MiniConfig } from "@/app/[lang]/_demo/_providers/MiniContext";

import type { DemoId } from "../../_data/docTypes";
import InlineText from "../InlineText";

const CONFIG: Record<Exclude<DemoId, "composition">, Partial<MiniConfig>> = {
  cupertino: { transition: "cupertino" },
  material: { transition: "material" },
  layout: { transition: "layout" },
  morph: { transition: "layout", morph: true },
  part: { transition: "cupertino", part: true }
};

export interface DocDemoProps {
  demo: DemoId;
  caption: string;
}

// A live demo inside a doc page: the Places app running the exact piece the
// page explains, with the readout under it and one line on what to try. The
// composition demo is the same app with every piece of it switched on at once.
function DocDemo({ demo, caption }: DocDemoProps) {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border border-line">
      <div className="bg-grid flex justify-center bg-bg-subtle px-4 py-8">
        {demo === "composition" ? (
          <TripDemo height="420px" />
        ) : (
          <MiniDemo config={CONFIG[demo]} height="420px" readout />
        )}
      </div>
      <figcaption className="flex items-start gap-3 border-t border-line bg-surface px-4 py-3 text-sm text-fg-muted">
        <span className="label mt-[3px] shrink-0 rounded-xs bg-accent-soft px-1.5 py-0.5 text-accent">
          Live
        </span>
        <span>
          <InlineText text={caption} />
        </span>
      </figcaption>
    </figure>
  );
}

export default DocDemo;
