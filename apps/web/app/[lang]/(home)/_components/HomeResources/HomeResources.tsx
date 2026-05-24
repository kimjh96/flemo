import Link from "next/link";

import GithubGlyph from "./GithubGlyph";

export type ResourceTarget = "docs" | "github";

export interface ResourceCard {
  label: string;
  body: string;
  cta: string;
  target: ResourceTarget;
}

export interface HomeResourcesProps {
  kicker: string;
  cards: ReadonlyArray<ResourceCard>;
  docsHref: string;
  githubHref: string;
}

function HomeResources({ kicker, cards, docsHref, githubHref }: HomeResourcesProps) {
  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-layer)]">
      <div className="mx-auto max-w-[1240px] px-6 py-24">
        <span className="kicker">{kicker}</span>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const href = card.target === "docs" ? docsHref : githubHref;
            const external = card.target === "github";
            return (
              <Link
                key={card.label}
                href={href}
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="group flex flex-col justify-between gap-10 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 transition-colors hover:border-[var(--color-text-primary)] sm:p-10"
              >
                <div>
                  <div className="flex items-center gap-2">
                    {card.target === "github" && <GithubGlyph />}
                    <h3 className="text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
                      {card.label}
                    </h3>
                  </div>
                  <p className="mt-3 text-[15px] leading-[1.6] text-[var(--color-text-secondary)]">
                    {card.body}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-primary)]">
                  {card.cta}
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

export default HomeResources;
