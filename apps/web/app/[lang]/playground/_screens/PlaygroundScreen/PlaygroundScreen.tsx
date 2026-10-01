"use client";

import { useState } from "react";

import { Screen, useNavigate } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import Stage from "../../_components/Stage";
import TonightRouter from "../../_router/TonightRouter";

import { CASES, DEFAULT_BENCH, type BenchCase } from "../../_providers/BenchContext";

function PlaygroundScreen() {
  const t = getDict(useShellLang()).playground;
  const navigate = useNavigate();
  const [bench, setBench] = useState<BenchCase>(DEFAULT_BENCH);

  const openComposition = () =>
    navigate.push("/playground/composition", {}, { transitionName: "shared-axis-forward" });

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <div className="h-full overflow-y-auto">
        <main className="playground-page">
          <div className="site-container">
            <p className="site-overline">{t.bench.label}</p>
            <div className="playground-heading">
              <h1 className="site-display-section">{t.title}</h1>
              <p className="site-lead">{t.subtitle}</p>
            </div>

            <div className="playground-workspace">
              <div className="playground-controls">
                <div className="playground-controls-heading">
                  <h2>{t.bench.label}</h2>
                  <p>{t.bench.note}</p>
                </div>
                <div role="radiogroup" aria-label={t.bench.label} className="playground-case-list">
                  {CASES.map((option) => (
                    <div
                      key={option.id}
                      className={
                        option.id === bench.id ? "playground-case is-active" : "playground-case"
                      }
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={option.id === bench.id}
                        onClick={() => setBench(option)}
                      >
                        {option.id}
                      </button>
                      <span>{t.bench.styles[option.id as keyof typeof t.bench.styles]}</span>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={openComposition} className="site-text-link mt-8">
                  {t.bench.next} <span aria-hidden="true">↗</span>
                </button>
              </div>

              <div className="playground-preview">
                <div className="playground-preview-caption">
                  <span className="home-lab-live-dot" aria-hidden="true" />
                  {bench.id}
                </div>
                <Stage>
                  <TonightRouter key={bench.id} bench={bench} />
                </Stage>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Screen>
  );
}

export default PlaygroundScreen;
