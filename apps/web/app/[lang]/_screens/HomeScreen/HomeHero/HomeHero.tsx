"use client";

import Button from "@/components/Button";
import Icon from "@/components/Icon";
import InstallCommand from "@/components/InstallCommand";
import HeroDemo from "@/app/[lang]/_components/HeroDemo";
import useSiteNavigate from "@/app/[lang]/_hooks/useSiteNavigate";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

function HomeHero() {
  const t = useShellDict().home;
  const { drillIntoDocs, drillIntoPlayground } = useSiteNavigate();

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-14 px-4 pt-16 pb-20 sm:px-6 lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10 lg:py-12">
        <div className="flex flex-col items-start">
          <span className="label inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-fg-muted">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-accent"
              style={{ animation: "signal-pulse 1.6s ease-in-out infinite" }}
            />
            {t.eyebrow}
          </span>
          <h1 className="mt-6 max-w-[13ch] text-display text-fg">{t.title}</h1>
          <p className="mt-6 max-w-[34rem] text-lead text-fg-muted">{t.subtitle}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => drillIntoDocs("getting-started")}>
              {t.ctaPrimary}
              <Icon name="arrowRight" size={16} />
            </Button>
            <Button size="lg" variant="secondary" onClick={drillIntoPlayground}>
              {t.ctaSecondary}
            </Button>
          </div>
          <InstallCommand className="mt-6" />
          <p className="mt-10 flex items-center gap-2 text-sm text-fg-subtle">
            <Icon name="swipe" size={16} />
            {t.demoHint}
          </p>
        </div>
        <HeroDemo />
      </div>
    </section>
  );
}

export default HomeHero;
