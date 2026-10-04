"use client";

import SectionHeading from "@/components/SectionHeading";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

// Four claims, each one something the engine actually does, laid out as an
// instrument panel: hairline cells, a mono reading, a label, one sentence.
function HomeEngine() {
  const t = useShellDict().home.engine;

  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6 lg:py-32">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} body={t.body} />
        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {t.items.map((item) => (
            <div key={item.title} className="flex flex-col gap-3 bg-surface p-6">
              <p className="font-mono text-h2 text-fg">{item.stat}</p>
              <p className="label text-accent">{item.title}</p>
              <p className="text-sm text-fg-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomeEngine;
