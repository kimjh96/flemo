"use client";

import { useRef, useState } from "react";

import { Screen } from "@flemo/react";

import CodeBlock from "@/components/CodeBlock";
import Icon from "@/components/Icon";
import TransitionReadout from "@/app/[lang]/_components/TransitionReadout";
import { useDict } from "@/app/[lang]/_providers/ShellIntlProvider";
import { GITHUB_URL } from "@/lib/i18n";

import Stage from "../../_components/Stage";
import { benchSpec } from "../../_data/benchSpecs";
import TonightRouter from "../../_router/TonightRouter";
import { CASES, DEFAULT_BENCH, type BenchCase } from "../../_providers/BenchContext";

// The presets the library ships, then the transitions this page authors. The
// authored ones sit in the same list on purpose: a consumer's own transition is
// not a second class of thing.
const PRESET_IDS = ["cupertino", "material", "layout", "none"];

const SOURCE_DIR = `${GITHUB_URL}/blob/main/apps/web/app/%5Blang%5D/playground/_transitions`;

// How a case is wired, as a reader would write it. Built from the case itself,
// so the snippet always names what the stage is running.
function caseCode(bench: BenchCase): string {
  const preset = PRESET_IDS.includes(bench.transition);
  const register = preset
    ? ""
    : `import ${bench.transition} from "./transitions/${bench.transition}";\n\n`;
  const router = preset
    ? `<Router history="memory">`
    : `<Router history="memory" transitions={[${bench.transition}]}>`;
  const morph = bench.cardMorph
    ? `<Morph layoutId={\`rowcard-\${id}\`} name="${bench.cardMorph}">`
    : `<Morph layoutId={\`row-\${id}\`} name="${bench.morph}">`;

  return `${register}${router}
  <Slot>{/* /tonight, /tonight/act/:id ... */}</Slot>
</Router>

// a row in the list
${morph}
  <Artwork />
</Morph>

navigate.push(
  "/tonight/act/:id",
  { id, from: "row" },
  { transitionName: "${bench.transition}" }
);`;
}

function PlaygroundScreen() {
  const t = useDict().playground;
  const [bench, setBench] = useState<BenchCase>(DEFAULT_BENCH);
  const glassRef = useRef<HTMLDivElement>(null);

  const presets = CASES.filter((entry) => PRESET_IDS.includes(entry.id));
  const authored = CASES.filter((entry) => !PRESET_IDS.includes(entry.id));
  const description = t.cases[bench.id as keyof typeof t.cases];

  const option = (entry: BenchCase) => {
    const on = entry.id === bench.id;
    return (
      <button
        key={entry.id}
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => setBench(entry)}
        className={`h-9 rounded-md border px-3 font-mono text-sm transition-colors ${
          on
            ? "border-fg bg-fg text-bg"
            : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg"
        }`}
      >
        {entry.id}
      </button>
    );
  };

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--bg)">
      <div className="h-full overflow-y-auto pt-14">
        <div className="mx-auto grid w-full max-w-[1280px] items-start gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:py-12">
          <div className="order-2 flex min-w-0 flex-col gap-8 lg:order-1">
            <div className="flex flex-col gap-4">
              <p className="label flex items-center gap-2 text-fg-subtle">
                <span aria-hidden="true" className="h-px w-4 bg-accent" />
                {t.eyebrow}
              </p>
              <h1 className="text-h1 text-fg">{t.title}</h1>
              <p className="max-w-[52ch] text-lead text-fg-muted">{t.subtitle}</p>
            </div>

            <div role="radiogroup" aria-label={t.bench.label} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <p className="label text-fg-subtle">{t.presets}</p>
                <div className="flex flex-wrap gap-1.5">{presets.map(option)}</div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="label text-fg-subtle">{t.authored}</p>
                <div className="flex flex-wrap gap-1.5">{authored.map(option)}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-body text-fg">{description}</p>
              <p className="text-sm text-fg-subtle">{t.bench.note}</p>
              <TransitionReadout
                hostRef={glassRef}
                name={bench.transition}
                spec={benchSpec(bench.transition)}
                className="max-w-[420px]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="label text-fg-subtle">{t.code}</p>
                {!PRESET_IDS.includes(bench.transition) && (
                  <a
                    href={`${SOURCE_DIR}/${bench.transition}.ts`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-fg-subtle transition-colors hover:text-fg"
                  >
                    {bench.transition}.ts
                    <Icon name="arrowUpRight" size={12} />
                  </a>
                )}
              </div>
              <CodeBlock code={caseCode(bench)} lang="tsx" title="Tonight.tsx" />
            </div>
          </div>

          {/* Remounting the app on a switch is deliberate: a change starts from a
              clean stack rather than landing mid-transition. */}
          <div ref={glassRef} className="order-1 flex justify-center lg:sticky lg:top-6 lg:order-2">
            <Stage>
              <TonightRouter key={bench.id} bench={bench} />
            </Stage>
          </div>
        </div>
      </div>
    </Screen>
  );
}

export default PlaygroundScreen;
