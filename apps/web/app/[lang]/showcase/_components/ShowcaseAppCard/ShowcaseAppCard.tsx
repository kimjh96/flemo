import Link from "next/link";

interface StoreLink {
  label: string;
  href: string;
}

export interface ShowcaseAppCardProps {
  name: string;
  tagline: string;
  description: string;
  flemoUsageLabel: string;
  flemoUsage: string;
  logo: string;
  screenshots: { src: string; alt: string }[];
  appStore?: StoreLink;
  playStore?: StoreLink;
}

export default function ShowcaseAppCard({
  name,
  tagline,
  description,
  flemoUsageLabel,
  flemoUsage,
  logo,
  screenshots,
  appStore,
  playStore
}: ShowcaseAppCardProps) {
  return (
    <article className="grid grid-cols-1 gap-10 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12 lg:p-12">
      <div className="flex flex-col gap-7">
        <div className="flex items-center gap-3.5">
          <img
            src={logo}
            alt={name}
            width={52}
            height={52}
            className="size-13 rounded-2xl border border-[var(--color-border-light)] bg-white"
          />
          <div>
            <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
              {name}
            </h2>
            <p className="text-[15px] text-[var(--color-text-secondary)]">{tagline}</p>
          </div>
        </div>

        <p className="text-[15px] leading-[1.7] text-[var(--color-text-secondary)]">
          {description}
        </p>

        <div>
          <span className="kicker">{flemoUsageLabel}</span>
          <p className="mt-2.5 text-[15px] leading-[1.7] text-[var(--color-text-secondary)]">
            {flemoUsage}
          </p>
        </div>

        {(appStore || playStore) && (
          <div className="flex flex-wrap gap-3">
            {appStore && (
              <Link
                href={appStore.href}
                target="_blank"
                rel="noreferrer"
                className="cta-pill !h-12"
              >
                {appStore.label}
              </Link>
            )}
            {playStore && (
              <Link
                href={playStore.href}
                target="_blank"
                rel="noreferrer"
                className="cta-pill-invert !h-12 border border-[var(--color-border)]"
              >
                {playStore.label}
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="-mx-2 flex snap-x gap-4 overflow-x-auto px-2 py-2 lg:mx-0 lg:px-0">
        {screenshots.map((screenshot) => (
          <img
            key={screenshot.src}
            src={screenshot.src}
            alt={screenshot.alt}
            width={1320}
            height={2868}
            loading="lazy"
            className="h-auto w-40 shrink-0 snap-start rounded-2xl border border-[var(--color-border-light)] sm:w-48"
          />
        ))}
      </div>
    </article>
  );
}
