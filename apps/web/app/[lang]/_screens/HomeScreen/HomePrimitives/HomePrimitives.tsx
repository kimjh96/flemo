"use client";

import { useState } from "react";

import SectionHeading from "@/components/SectionHeading";
import SegmentedControl from "@/components/SegmentedControl";
import MiniDemo from "@/app/[lang]/_components/MiniDemo";
import type { MiniConfig } from "@/app/[lang]/_demo/_providers/MiniContext";
import useSiteNavigate from "@/app/[lang]/_hooks/useSiteNavigate";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import PrimitiveCard from "./PrimitiveCard";

const PRESETS: MiniConfig["transition"][] = ["cupertino", "material", "layout"];

const STAGE_HEIGHT = "380px";

// Four live pieces in a row, each one a nested Router showing only that piece,
// then the three that do not need a stage to be understood.
function HomePrimitives() {
  const t = useShellDict().home.primitives;
  const { drillIntoDocs } = useSiteNavigate();
  const [preset, setPreset] = useState<MiniConfig["transition"]>("cupertino");

  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6 lg:py-32">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} body={t.body} />

        <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PrimitiveCard
            icon="layers"
            title={t.transitions.title}
            body={t.transitions.body}
            onOpen={() => drillIntoDocs("transitions")}
            controls={
              <SegmentedControl
                label={t.transitions.title}
                options={PRESETS.map((value) => ({ value, label: value }))}
                value={preset}
                onChange={setPreset}
                size="sm"
                mono
              />
            }
            stage={<MiniDemo config={{ transition: preset }} height={STAGE_HEIGHT} />}
          />
          <PrimitiveCard
            icon="swipe"
            title={t.gesture.title}
            body={t.gesture.body}
            onOpen={() => drillIntoDocs("transitions")}
            controls={
              <p className="text-center text-xs font-medium text-accent">{t.gesture.hint}</p>
            }
            stage={
              <MiniDemo
                config={{ transition: "cupertino" }}
                height={STAGE_HEIGHT}
                autoplay={false}
              />
            }
          />
          <PrimitiveCard
            icon="sparkle"
            title={t.morph.title}
            body={t.morph.body}
            onOpen={() => drillIntoDocs("morph")}
            controls={
              <code className="font-mono text-xs text-fg-subtle">{"<Morph layoutId>"}</code>
            }
            stage={
              <MiniDemo config={{ transition: "layout", morph: true }} height={STAGE_HEIGHT} />
            }
          />
          <PrimitiveCard
            icon="menu"
            title={t.part.title}
            body={t.part.body}
            onOpen={() => drillIntoDocs("part")}
            controls={
              <code className="font-mono text-xs text-fg-subtle">{"sharedTopBar + <Part>"}</code>
            }
            stage={
              <MiniDemo config={{ transition: "cupertino", part: true }} height={STAGE_HEIGHT} />
            }
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <PrimitiveCard
            icon="layers"
            title={t.nested.title}
            body={t.nested.body}
            onOpen={() => drillIntoDocs("router")}
          />
          <PrimitiveCard
            icon="book"
            title={t.layer.title}
            body={t.layer.body}
            onOpen={() => drillIntoDocs("layer")}
          />
          <PrimitiveCard
            icon="terminal"
            title={t.typed.title}
            body={t.typed.body}
            onOpen={() => drillIntoDocs("router")}
          />
        </div>
      </div>
    </section>
  );
}

export default HomePrimitives;
