import Link from "next/link";

import HeroDemo from "./_components/HeroDemo";
import Logo from "@/components/Logo";
import { getDict, i18n } from "@/lib/i18n";

const GITHUB_URL = "https://github.com/kimjh96/flemo";

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const t = getDict(lang);
  const docsHref = lang === i18n.defaultLanguage ? "/docs" : `/${lang}/docs`;

  return (
    <main className="bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <Hero
        title={t.hero.title}
        tag={t.hero.tag}
        ctaPrimary={{ label: t.hero.ctaPrimary, href: docsHref }}
        ctaSecondary={{ label: t.hero.ctaSecondary, href: GITHUB_URL }}
        lang={lang}
      />
      <Features items={t.features} />
      <Resources
        kicker={t.resources.kicker}
        cards={t.resources.cards}
        docsHref={docsHref}
        githubHref={GITHUB_URL}
      />
      <Footer built={t.footer.built} />
    </main>
  );
}

function Hero({
  title,
  tag,
  ctaPrimary,
  ctaSecondary,
  lang
}: {
  title: string;
  tag: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };
  lang: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)]">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-16 px-6 pt-24 pb-24 sm:pt-32 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:pt-40 lg:pb-32">
        <div className="flex flex-col justify-center">
          <h1 className="display max-w-[14ch] text-balance text-[40px] leading-[1.05] sm:text-[64px] lg:text-[80px]">
            {title}
          </h1>
          <p className="mt-6 text-[14px] font-medium tracking-[0.01em] text-[var(--color-neutral-700)]">
            {tag}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <Link href={ctaPrimary.href} className="cta-pill">
              {ctaPrimary.label}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M13 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href={ctaSecondary.href} target="_blank" rel="noreferrer" className="cta-ghost">
              {ctaSecondary.label}
            </Link>
          </div>
        </div>
        <div className="flex items-center justify-center lg:justify-end">
          <HeroDemo lang={lang} />
        </div>
      </div>
    </section>
  );
}

type FeatureIcon = "phone" | "swipe" | "code" | "layers" | "sparkle" | "palette";

function Features({
  items
}: {
  items: ReadonlyArray<{ icon: FeatureIcon; label: string; body: string }>;
}) {
  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[1240px] px-6 py-24">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.label}
              className="flex flex-col gap-7 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 transition-colors hover:border-[var(--color-text-secondary)]"
            >
              <FeatureIconBox icon={it.icon} />
              <div className="flex flex-col gap-2">
                <h3 className="text-[18px] font-bold tracking-[-0.01em] text-[var(--color-text-primary)]">
                  {it.label}
                </h3>
                <p className="text-[14.5px] leading-[1.65] text-[var(--color-text-secondary)]">
                  {it.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureIconBox({ icon }: { icon: FeatureIcon }) {
  return (
    <div
      className="flex size-11 items-center justify-center rounded-xl text-white"
      style={{ background: "var(--color-primary)" }}
    >
      <FeatureIconSvg icon={icon} />
    </div>
  );
}

function FeatureIconSvg({ icon }: { icon: FeatureIcon }) {
  const stroke = {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (icon) {
    case "phone":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <rect x="6" y="3" width="12" height="18" rx="2.5" {...stroke} />
          <path d="M11 17h2" {...stroke} />
        </svg>
      );
    case "swipe":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M5 12h14" {...stroke} />
          <path d="M11 6l-6 6 6 6" {...stroke} />
          <path d="M19 7v10" {...stroke} />
        </svg>
      );
    case "code":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M9 8l-5 4 5 4" {...stroke} />
          <path d="M15 8l5 4-5 4" {...stroke} />
          <path d="M14 5l-4 14" {...stroke} />
        </svg>
      );
    case "layers":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M12 3l9 5-9 5-9-5 9-5z" {...stroke} />
          <path d="M3 13l9 5 9-5" {...stroke} />
          <path d="M3 17l9 5 9-5" {...stroke} />
        </svg>
      );
    case "sparkle":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" {...stroke} />
          <path
            d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7L19 16z"
            {...stroke}
          />
        </svg>
      );
    case "palette":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path
            d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.5-1.1-.4-.4-.5-.9-.5-1.4 0-1 .9-1.8 1.9-1.8H16a5 5 0 0 0 5-5 9 9 0 0 0-9-7.2z"
            {...stroke}
          />
          <circle cx="7.5" cy="11" r=".9" fill="currentColor" />
          <circle cx="9" cy="7.5" r=".9" fill="currentColor" />
          <circle cx="13" cy="6.5" r=".9" fill="currentColor" />
          <circle cx="16.5" cy="9" r=".9" fill="currentColor" />
        </svg>
      );
  }
}

function Resources({
  kicker,
  cards,
  docsHref,
  githubHref
}: {
  kicker: string;
  cards: ReadonlyArray<{
    label: string;
    body: string;
    cta: string;
    target: "docs" | "github";
  }>;
  docsHref: string;
  githubHref: string;
}) {
  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-layer)]">
      <div className="mx-auto max-w-[1240px] px-6 py-24">
        <span className="kicker">{kicker}</span>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((c) => {
            const href = c.target === "docs" ? docsHref : githubHref;
            const external = c.target === "github";
            return (
              <Link
                key={c.label}
                href={href}
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="group flex flex-col justify-between gap-10 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 transition-colors hover:border-[var(--color-text-primary)] sm:p-10"
              >
                <div>
                  <div className="flex items-center gap-2">
                    {c.target === "github" && (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="text-[var(--color-text-primary)]"
                      >
                        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55 0-.27-.01-1.16-.02-2.1-3.2.7-3.87-1.36-3.87-1.36-.52-1.34-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.97 10.97 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.26 5.68.41.36.78 1.07.78 2.16 0 1.56-.01 2.81-.01 3.19 0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                      </svg>
                    )}
                    <h3 className="text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
                      {c.label}
                    </h3>
                  </div>
                  <p className="mt-3 text-[15px] leading-[1.6] text-[var(--color-text-secondary)]">
                    {c.body}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-primary)]">
                  {c.cta}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12h14M13 5l7 7-7 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Footer({ built }: { built: string }) {
  return (
    <footer className="bg-[var(--color-bg)]">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-8">
        <span className="text-[13px] text-[var(--color-neutral-600)]">{built}</span>
        <span className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
          <Logo size={20} className="rounded-[5px]" />
          flemo
        </span>
      </div>
    </footer>
  );
}
