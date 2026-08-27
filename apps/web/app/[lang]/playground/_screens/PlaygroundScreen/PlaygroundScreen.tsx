"use client";

import { useState } from "react";

import { Screen } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import CaseRail from "../../_components/CaseRail";
import StackReadout from "../../_components/StackReadout";
import StageFrame from "../../_components/StageFrame";

import { TelemetryProvider } from "../../_providers/TelemetryContext";
import {
  DEFAULT_CHOICE,
  MORPHS,
  TRANSITIONS,
  type MotionChoice
} from "../../_providers/MotionChoiceContext";

import BookingRouter from "../../_router/BookingRouter";
import TonightRouter from "../../_router/TonightRouter";

// The playground as a PEER of Home, Showcase and Docs: a screen of the shell's
// own Router rather than a page beside it.
//
// Which means the app runs as a Router inside a screen of another Router, on a
// site that is itself a flemo app. That is not incidental — it is the shape a
// consumer's own app has, and it is now exercised by every visit.
//
// ONE PAGE, ONE STAGE. The previous version stacked two full-viewport hero
// sections, each a copy of the landing hero's layout, so the page read as a
// second landing and its second case was reachable only by scrolling past a
// phone that swallowed the scroll wheel. There is one stage here, and the rail
// swaps what runs in it.
const PILL =
  "cursor-pointer rounded-lg px-3 py-1.5 font-mono text-[13px] font-semibold transition-colors";
const PILL_ON = "bg-[var(--color-primary)] text-white";
const PILL_OFF =
  "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]";
const GROUP = "flex w-fit flex-wrap gap-1 rounded-xl bg-[var(--color-layer)] p-1";
const LABEL =
  "text-[11px] font-semibold tracking-[0.1em] text-[var(--color-text-disabled)] uppercase";

function PlaygroundScreen() {
  const t = getDict(useShellLang()).playground;
  const [activeCase, setActiveCase] = useState("transitions");
  const [choice, setChoice] = useState<MotionChoice>(DEFAULT_CHOICE);

  // Remounting the app on either switch is deliberate: a change should start
  // from a clean stack rather than land mid-flight.
  const benchKey = `${choice.transition.id}-${choice.morph.id}`;

  const scopes =
    activeCase === "transitions"
      ? [
          { id: "tonight", label: t.scopes.app },
          { id: "browse", label: t.scopes.tab }
        ]
      : [{ id: "booking", label: t.scopes.flow }];

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="transparent">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-[1180px] px-6 pt-24 pb-16 lg:pt-28">
          <TelemetryProvider>
            {/* The stage shares the page's TOP, not the space left under a
                block of prose. A phone frame pushed below a heading and a rail
                has a few hundred pixels of viewport left and gets clipped by
                them, which is what the first pass of this layout did. */}
            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="order-2 flex flex-col gap-5 lg:order-1">
                <div className="flex flex-col gap-3">
                  <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.1] font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
                    {t.title}
                  </h1>
                  <p className="max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                    {t.subtitle}
                  </p>
                </div>

                <CaseRail
                  value={activeCase}
                  onChange={setActiveCase}
                  options={[
                    { id: "transitions", label: t.cases.transitions },
                    { id: "stack", label: t.cases.stack },
                    { id: "overlays", label: t.cases.overlays, href: "/playground/layer" }
                  ]}
                />
                <p className="max-w-[46ch] text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {activeCase === "transitions" ? t.cases.transitionsBody : t.cases.stackBody}
                </p>

                {activeCase === "transitions" ? (
                  <>
                    {/* Split by origin, because which of these flemo ships and
                        which the site wrote is the point of having both: a
                        consumer's transition is not a second class of thing,
                        and the two groups behave identically. */}
                    {(["built-in", "authored"] as const).map((origin) => (
                      <div key={origin} className="flex flex-col gap-1.5">
                        <span className={LABEL}>
                          {t.bench[origin === "built-in" ? "builtIn" : "authored"]}
                        </span>
                        <div
                          role="radiogroup"
                          aria-label={t.bench[origin === "built-in" ? "builtIn" : "authored"]}
                          className={GROUP}
                        >
                          {TRANSITIONS.filter((entry) => entry.origin === origin).map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              role="radio"
                              aria-checked={entry.id === choice.transition.id}
                              onClick={() =>
                                setChoice((current) => ({ ...current, transition: entry }))
                              }
                              className={`${PILL} ${
                                entry.id === choice.transition.id ? PILL_ON : PILL_OFF
                              }`}
                            >
                              {entry.id}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="flex flex-col gap-1.5">
                      <span className={LABEL}>{t.bench.element}</span>
                      <div role="radiogroup" aria-label={t.bench.element} className={GROUP}>
                        {MORPHS.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            role="radio"
                            aria-checked={entry.id === choice.morph.id}
                            onClick={() => setChoice((current) => ({ ...current, morph: entry }))}
                            className={`${PILL} ${
                              entry.id === choice.morph.id ? PILL_ON : PILL_OFF
                            }`}
                          >
                            {entry.id}
                          </button>
                        ))}
                      </div>
                    </div>

                    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-[13px]">
                      <dt className="text-[var(--color-text-disabled)]">{t.bench.screen}</dt>
                      <dd className="m-0 leading-relaxed text-[var(--color-text-secondary)]">
                        {t.transitions[choice.transition.id]}
                      </dd>
                      <dt className="text-[var(--color-text-disabled)]">{t.bench.element}</dt>
                      <dd className="m-0 leading-relaxed text-[var(--color-text-secondary)]">
                        {t.morphs[choice.morph.id]}
                      </dd>
                    </dl>
                  </>
                ) : null}

                <StackReadout scopes={scopes} />
              </div>

              <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
                <StageFrame marker={activeCase}>
                  {activeCase === "transitions" ? (
                    <TonightRouter key={benchKey} choice={choice} />
                  ) : (
                    <BookingRouter />
                  )}
                </StageFrame>
              </div>
            </div>
          </TelemetryProvider>
        </div>
      </div>
    </Screen>
  );
}

export default PlaygroundScreen;
