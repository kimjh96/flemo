"use client";

import { Screen, useNavigate } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";
import Stage from "@/app/[lang]/playground/_components/Stage";
import { DEFAULT_BENCH } from "@/app/[lang]/playground/_providers/BenchContext";
import TonightRouter from "@/app/[lang]/playground/_router/TonightRouter";

function HomeScreen() {
  const { home } = useShellDict();
  const navigate = useNavigate();
  const openDocs = () => navigate.push("/docs", {}, { transitionName: "docs-enter" });
  const openPlayground = () =>
    navigate.push("/playground", {}, { transitionName: "shared-axis-forward" });
  const openComposition = () =>
    navigate.push("/playground/composition", {}, { transitionName: "shared-axis-forward" });
  const openShowcase = () =>
    navigate.push("/showcase", {}, { transitionName: "shared-axis-forward" });

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <div className="h-full overflow-y-auto" data-testid="home-scroll">
        <main>
          <section className="home-hero relative overflow-hidden px-5 pt-32 pb-20 sm:px-8 lg:pt-36 lg:pb-28">
            <div
              className="pointer-events-none absolute inset-0 home-hero-light"
              aria-hidden="true"
            />
            <div className="site-container relative grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.82fr)] lg:gap-16">
              <div className="max-w-[610px]">
                <span className="site-eyebrow">{home.kicker}</span>
                <h1 className="mt-6 max-w-[11ch] text-[clamp(3rem,6.4vw,5.8rem)] leading-[1.04] font-extrabold tracking-[-0.065em] text-[var(--color-text-primary)] break-keep">
                  {home.title}
                </h1>
                <p className="mt-7 max-w-[43ch] text-[clamp(1.05rem,1.6vw,1.25rem)] leading-[1.65] text-[var(--color-text-secondary)] break-keep">
                  {home.subtitle}
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-3">
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
                <p className="mt-8 text-sm text-[var(--color-text-tertiary)]">{home.heroNote}</p>
              </div>
              <div
                id="live-demo"
                className="relative scroll-mt-28 justify-self-center lg:justify-self-end"
              >
                <div className="mb-4 flex items-center justify-between gap-4 px-2 text-xs font-semibold tracking-[0.08em] text-[var(--color-text-secondary)] uppercase">
                  <span>{home.demoLabel}</span>
                  <span className="flex items-center gap-2 normal-case tracking-normal">
                    <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    {home.demoLive}
                  </span>
                </div>
                <Stage>
                  <TonightRouter bench={DEFAULT_BENCH} initPath="/tonight/posters" />
                </Stage>
                <p className="mt-4 max-w-[34ch] text-center text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {home.demoHint}
                </p>
              </div>
            </div>
          </section>

          <section className="site-section border-t border-[var(--color-border-light)] bg-[var(--color-surface)]">
            <div className="site-container">
              <div className="max-w-[700px]">
                <span className="site-eyebrow">{home.featuresKicker}</span>
                <h2 className="site-section-title mt-5">{home.featuresTitle}</h2>
                <p className="site-section-copy mt-5">{home.featuresIntro}</p>
              </div>
              <div className="mt-12 grid gap-4 md:grid-cols-3">
                {home.features.map((feature, index) => (
                  <article key={feature.title} className="site-feature-card">
                    <span className="text-xs font-semibold tracking-[0.12em] text-[var(--color-primary)] tabular-nums">
                      0{index + 1}
                    </span>
                    <div className="site-feature-mark mt-8" aria-hidden="true">
                      <span className="site-feature-mark-inner" />
                    </div>
                    <h3 className="mt-8 text-[1.35rem] leading-tight font-bold tracking-[-0.035em] text-[var(--color-text-primary)]">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-[15px] leading-[1.7] text-[var(--color-text-secondary)] break-keep">
                      {feature.body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="site-section">
            <div className="site-container grid items-center gap-10 lg:grid-cols-[0.8fr_1fr] lg:gap-20">
              <div>
                <span className="site-eyebrow">{home.buildKicker}</span>
                <h2 className="site-section-title mt-5">{home.buildTitle}</h2>
                <p className="site-section-copy mt-5">{home.buildBody}</p>
                <button
                  type="button"
                  onClick={openDocs}
                  className="site-button site-button-secondary mt-8"
                >
                  {home.buildCta} <span aria-hidden="true">↗</span>
                </button>
              </div>
              <div className="overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-code-bg)] shadow-[0_24px_70px_-44px_rgba(20,40,80,0.45)]">
                <div className="flex h-12 items-center gap-2 border-b border-white/10 px-5">
                  <span className="size-2 rounded-full bg-rose-400" />
                  <span className="size-2 rounded-full bg-amber-400" />
                  <span className="size-2 rounded-full bg-emerald-400" />
                  <span className="ml-4 font-mono text-xs text-slate-400">App.tsx</span>
                </div>
                <pre className="overflow-x-auto p-6 text-[13px] leading-[1.9] text-slate-100 sm:p-8 sm:text-sm">
                  <code>{`import { Router, Route, Screen } from "@flemo/react";

<Router defaultTransitionName="cupertino">
  <Route path="/" element={<Screen>Home</Screen>} />
  <Route path="/detail" element={<Screen>Detail</Screen>} />
</Router>`}</code>
                </pre>
              </div>
            </div>
          </section>

          <section className="site-section border-t border-[var(--color-border-light)] bg-[var(--color-layer)]">
            <div className="site-container grid gap-5 md:grid-cols-2">
              <div className="site-link-card">
                <span className="site-eyebrow">{home.exploreKicker}</span>
                <h2 className="mt-5 text-2xl font-bold tracking-[-0.035em] text-[var(--color-text-primary)]">
                  {home.exploreTitle}
                </h2>
                <p className="mt-3 max-w-[48ch] text-[15px] leading-[1.7] text-[var(--color-text-secondary)]">
                  {home.exploreBody}
                </p>
                <button type="button" onClick={openComposition} className="site-text-link mt-7">
                  {home.exploreCta} <span aria-hidden="true">↗</span>
                </button>
              </div>
              <div className="site-link-card">
                <span className="site-eyebrow">{home.showcaseKicker}</span>
                <h2 className="mt-5 text-2xl font-bold tracking-[-0.035em] text-[var(--color-text-primary)]">
                  {home.showcaseTitle}
                </h2>
                <p className="mt-3 max-w-[48ch] text-[15px] leading-[1.7] text-[var(--color-text-secondary)]">
                  {home.showcaseBody}
                </p>
                <button type="button" onClick={openShowcase} className="site-text-link mt-7">
                  {home.showcaseCta} <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </section>
          <footer className="site-container flex flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-[var(--color-text-tertiary)] sm:px-8">
            <span>flemo · MIT</span>
            <button type="button" onClick={openPlayground} className="site-text-link text-sm">
              {home.footerPlayground} ↗
            </button>
          </footer>
        </main>
      </div>
    </Screen>
  );
}

export default HomeScreen;
