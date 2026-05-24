import Link from "next/link";

import HeroDemo from "./HeroDemo";

export interface HomeHeroProps {
  title: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };
  lang: string;
}

function HomeHero({ title, ctaPrimary, ctaSecondary, lang }: HomeHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)]">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-16 px-6 pt-24 pb-24 sm:pt-32 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:pt-40 lg:pb-32">
        <div className="flex flex-col justify-center">
          <h1 className="display max-w-[14ch] text-balance text-[40px] leading-[1.05] sm:text-[64px] lg:text-[80px]">
            {title}
          </h1>
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
            <Link href={ctaSecondary.href} className="cta-ghost">
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

export default HomeHero;
