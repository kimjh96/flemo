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
  languagesLabel: string;
  languages: string[];
  logo: string;
  appStore?: StoreLink;
  playStore?: StoreLink;
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0" fill="currentColor">
      <path d="M16.36 12.72c-.02-2.24 1.83-3.32 1.91-3.37-1.04-1.52-2.66-1.73-3.24-1.75-1.38-.14-2.69.81-3.39.81-.7 0-1.78-.79-2.92-.77-1.5.02-2.89.87-3.66 2.21-1.56 2.71-.4 6.71 1.12 8.9.74 1.07 1.63 2.28 2.79 2.23 1.12-.04 1.54-.72 2.9-.72 1.35 0 1.74.72 2.92.7 1.21-.02 1.97-1.09 2.71-2.17.85-1.24 1.2-2.44 1.22-2.5-.03-.01-2.34-.9-2.36-3.57ZM14.15 5.9c.62-.75 1.03-1.79.92-2.83-.89.04-1.96.59-2.6 1.34-.57.66-1.07 1.72-.94 2.74.99.07 2-.5 2.62-1.25Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0" fill="currentColor">
      <path d="M3.6 2.34a1 1 0 0 0-.6.92v17.48a1 1 0 0 0 .6.92l9.44-9.66L3.6 2.34Zm10.63 8.4 2.62-2.68-9.9-5.63 7.28 8.31Zm0 2.52-7.28 8.31 9.9-5.63-2.62-2.68Zm1.42-1.45 3.14 3.21 2.62-1.49c.94-.54.94-1.9 0-2.44l-2.62-1.49-3.14 3.21Z" />
    </svg>
  );
}

// One app in the Showcase grid: an app-store style identity row on top, the
// pitch and the "how it uses flemo" note in the middle, and the meta row
// (languages, store links) pinned to the bottom so cards in a row line up.
export default function ShowcaseAppCard({
  name,
  tagline,
  description,
  flemoUsageLabel,
  flemoUsage,
  languagesLabel,
  languages,
  logo,
  appStore,
  playStore
}: ShowcaseAppCardProps) {
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-7 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-dark)] hover:shadow-[0_18px_40px_-24px_rgba(25,31,40,0.35)] sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-20 size-56 rounded-full bg-[var(--color-primary)] opacity-[0.07] blur-3xl"
      />

      <div className="relative flex items-center gap-4">
        <img
          src={logo}
          alt=""
          width={56}
          height={56}
          className="size-14 shrink-0 rounded-2xl border border-[var(--color-border-light)] bg-white"
        />
        <div className="min-w-0">
          <h2 className="truncate text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            {name}
          </h2>
          <p className="truncate text-[14px] text-[var(--color-text-secondary)]">{tagline}</p>
        </div>
      </div>

      <p className="relative mt-6 text-[15px] leading-[1.7] break-keep text-[var(--color-text-secondary)]">
        {description}
      </p>

      <div className="relative mt-6 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-layer)] p-5">
        <span className="kicker">{flemoUsageLabel}</span>
        <p className="mt-2 text-[14px] leading-[1.7] break-keep text-[var(--color-text-secondary)]">
          {flemoUsage}
        </p>
      </div>

      <div className="relative mt-7 flex flex-col gap-5 border-t border-[var(--color-border-light)] pt-6 sm:mt-auto">
        {languages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              {languagesLabel}
            </span>
            {languages.map((language) => (
              <span key={language} className="chip">
                {language}
              </span>
            ))}
          </div>
        )}

        {(appStore || playStore) && (
          <div className="flex flex-wrap gap-2.5">
            {appStore && (
              <Link
                href={appStore.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-[14px] font-semibold tracking-[-0.01em] text-white transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                <AppleIcon />
                {appStore.label}
              </Link>
            )}
            {playStore && (
              <Link
                href={playStore.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-layer)]"
              >
                <PlayIcon />
                {playStore.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
