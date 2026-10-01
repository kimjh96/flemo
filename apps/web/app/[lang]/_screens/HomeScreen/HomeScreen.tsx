"use client";

import { useState } from "react";

import { Screen, useNavigate } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";
import Stage from "@/app/[lang]/playground/_components/Stage";
import { DEFAULT_BENCH } from "@/app/[lang]/playground/_providers/BenchContext";
import CompositionRouter from "@/app/[lang]/playground/_router/CompositionRouter";
import TonightRouter from "@/app/[lang]/playground/_router/TonightRouter";

function HomeScreen() {
  const { home } = useShellDict();
  const navigate = useNavigate();
  const [demoIndex, setDemoIndex] = useState(0);
  const currentDemo = home.demoModes[demoIndex];

  const openDocs = () => navigate.push("/docs", {}, { transitionName: "docs-enter" });
  const openPlayground = () =>
    navigate.push("/playground", {}, { transitionName: "shared-axis-forward" });
  const openShowcase = () =>
    navigate.push("/showcase", {}, { transitionName: "shared-axis-forward" });

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <div className="h-full overflow-y-auto" data-testid="home-scroll">
        <main>
          <section className="home-intro">
            <div className="site-container">
              <p className="site-overline">{home.kicker}</p>
              <div className="home-intro-grid">
                <h1 className="home-display">{home.title}</h1>
                <div className="home-intro-aside">
                  <p className="site-lead">{home.subtitle}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a href="#live-demo" className="site-button site-button-primary">
                      {home.ctaDemo} <span aria-hidden="true">↗</span>
                    </a>
                    <button
                      type="button"
                      onClick={openDocs}
                      className="site-button site-button-secondary"
                    >
                      {home.ctaPrimary}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="live-demo" className="home-lab scroll-mt-4">
            <div className="site-container">
              <div className="home-lab-workspace">
                <div className="home-lab-controls">
                  <div className="home-lab-heading">
                    <p className="site-overline site-overline-light">{home.labKicker}</p>
                    <h2 className="home-lab-title">{home.labTitle}</h2>
                    <p className="home-lab-intro">{home.labBody}</p>
                  </div>
                  <div className="home-lab-choice" role="tablist" aria-label={home.labKicker}>
                    {home.demoModes.map((mode, index) => (
                      <button
                        key={mode.title}
                        type="button"
                        role="tab"
                        aria-selected={demoIndex === index}
                        onClick={() => setDemoIndex(index)}
                        className={demoIndex === index ? "home-lab-tab is-active" : "home-lab-tab"}
                      >
                        <span className="home-lab-tab-number">0{index + 1}</span>
                        <span className="home-lab-tab-copy">
                          <strong>{mode.title}</strong>
                          <small>{mode.subtitle}</small>
                        </span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                  <div className="home-lab-steps">
                    <p className="home-lab-steps-title">{currentDemo.title}</p>
                    <ol>
                      {currentDemo.steps.map((step, index) => (
                        <li key={step}>
                          <span>0{index + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <p className="home-lab-footnote">{home.labFootnote}</p>
                </div>

                <div className="home-lab-preview">
                  <div className="home-lab-live">
                    <span className="home-lab-live-dot" aria-hidden="true" />
                    {home.demoLive}
                  </div>
                  <Stage compact>
                    {demoIndex === 0 ? (
                      <TonightRouter bench={DEFAULT_BENCH} initPath="/tonight/posters" />
                    ) : (
                      <CompositionRouter />
                    )}
                  </Stage>
                </div>
              </div>
            </div>
          </section>

          <section className="home-moments">
            <div className="site-container">
              <div className="home-moments-heading">
                <p className="site-overline">{home.featuresKicker}</p>
                <h2 className="site-display-section">{home.featuresTitle}</h2>
              </div>
              <div className="home-moment-list">
                {home.features.map((feature, index) => (
                  <article key={feature.title} className="home-moment">
                    <span className="home-moment-number">0{index + 1}</span>
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                  </article>
                ))}
              </div>
              <button type="button" onClick={openPlayground} className="site-text-link mt-10">
                {home.compareCta} <span aria-hidden="true">↗</span>
              </button>
            </div>
          </section>

          <section className="home-build">
            <div className="site-container home-build-grid">
              <div>
                <p className="site-overline">{home.buildKicker}</p>
                <h2 className="site-display-section mt-6">{home.buildTitle}</h2>
                <p className="site-lead mt-6">{home.buildBody}</p>
                <button
                  type="button"
                  onClick={openDocs}
                  className="site-button site-button-primary mt-8"
                >
                  {home.buildCta} <span aria-hidden="true">↗</span>
                </button>
              </div>
              <div className="home-build-code">
                <div className="home-build-code-header">
                  <span>{home.installLabel}</span>
                  <span>01 / 02</span>
                </div>
                <pre>
                  <code>pnpm add @flemo/react</code>
                </pre>
                <div className="home-build-code-header home-build-code-divider">
                  <span>App.tsx</span>
                  <span>02 / 02</span>
                </div>
                <pre>
                  <code>{`import { Router, Route } from "@flemo/react";

<Router defaultTransitionName="cupertino">
  <Route path="/" element={<Home />} />
  <Route path="/detail" element={<Detail />} />
</Router>`}</code>
                </pre>
              </div>
            </div>
          </section>

          <section className="home-showcase">
            <div className="site-container home-showcase-grid">
              <div>
                <p className="site-overline">{home.showcaseKicker}</p>
                <h2 className="site-display-section mt-5">{home.showcaseTitle}</h2>
              </div>
              <div className="home-showcase-case">
                <img src="/shiflo/logo.png" alt="" width={68} height={68} />
                <div>
                  <strong>shiflo</strong>
                  <p>{home.showcaseBody}</p>
                  <button type="button" onClick={openShowcase} className="site-text-link mt-4">
                    {home.showcaseCta} <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <footer className="site-container home-footer">
            <span>flemo · MIT</span>
            <button type="button" onClick={openPlayground} className="site-text-link">
              {home.footerPlayground} ↗
            </button>
          </footer>
        </main>
      </div>
    </Screen>
  );
}

export default HomeScreen;
