"use client";

import { useState } from "react";

import { Screen } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import DevtoolsPanel from "../../_components/DevtoolsPanel";
import Stage from "../../_components/Stage";

import TonightRouter from "../../_router/TonightRouter";

import { DEFAULT_BENCH, TRANSITIONS, type Bench } from "../../_providers/BenchContext";

// The playground as a PEER of Home, Showcase and Docs: a screen of the site's
// own Router, so the mini-app runs as a nested Router inside a screen of
// another Router: the shape a consumer's app actually has.
//
// ONE AXIS. The previous version of this page crossed six transitions with
// three morph presets, generated a part transition per direction per preset,
// and got the basics wrong underneath all of it. The library author's own demos
// pair one element and change nothing else. This starts there; a second axis
// goes in only after the first is judged good.
//
// Remounting the app on a switch is deliberate: a change starts from a clean
// stack rather than landing mid-flight. It also keeps the controls from
// mutating a screen DURING a flight, which `arrivalHold` would hide until rest
// anyway ("a MutationObserver hides mid-flight swaps and additions ... then
// reflects them in one rest commit").
const PILL =
  "cursor-pointer rounded-lg px-3 py-1.5 font-mono text-[13px] font-semibold transition-colors";
const PILL_ON = "bg-[var(--color-primary)] text-white";
const PILL_OFF =
  "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]";

function PlaygroundScreen() {
  const t = getDict(useShellLang()).playground;
  const [bench, setBench] = useState<Bench>(DEFAULT_BENCH);

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="transparent">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-[1180px] px-6 pt-24 pb-16 lg:pt-28">
          {/* The copy centres against the stage rather than hugging the top of
              it. The stage is as tall as the viewport allows, so top alignment
              left the whole lower half of a desktop window empty. */}
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            {/* No measure on the column itself. Both paragraphs carry their
                own, and capping the column made the seven-option selector wrap
                with one pill stranded on a second row. */}
            <div className="order-2 flex flex-col gap-5 lg:order-1">
              <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.1] font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
                {t.title}
              </h1>
              <p className="max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                {t.subtitle}
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-[0.1em] text-[var(--color-text-disabled)] uppercase">
                  {t.bench.label}
                </span>
                <div
                  role="radiogroup"
                  aria-label={t.bench.label}
                  className="flex w-fit flex-wrap gap-1 rounded-xl bg-[var(--color-layer)] p-1"
                >
                  {TRANSITIONS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={name === bench.transition}
                      onClick={() => setBench({ transition: name })}
                      className={`${PILL} ${name === bench.transition ? PILL_ON : PILL_OFF}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <p className="max-w-[46ch] text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {t.bench.note}
              </p>
            </div>

            <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
              <Stage>
                <TonightRouter key={bench.transition} bench={bench} />
              </Stage>
            </div>
          </div>
        </div>
      </div>
      <DevtoolsPanel />
    </Screen>
  );
}

export default PlaygroundScreen;
