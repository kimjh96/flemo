import Link from "next/link";

export interface ShowcaseSubmitCardProps {
  title: string;
  body: string;
  cta: string;
  href: string;
}

// The grid's closing tile: a quiet dashed card that keeps the row balanced
// while the showcase is short, and invites the next app into it.
export default function ShowcaseSubmitCard({ title, body, cta, href }: ShowcaseSubmitCardProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[var(--color-border-dark)] bg-[var(--color-layer)] p-8 text-center transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-bg)]"
    >
      <span className="flex size-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] transition-colors group-hover:border-[var(--color-primary)] group-hover:text-[var(--color-primary)]">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="currentColor">
          <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" />
        </svg>
      </span>
      <span className="text-[17px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
        {title}
      </span>
      <span className="max-w-[26ch] text-[14px] leading-[1.7] break-keep text-[var(--color-text-secondary)]">
        {body}
      </span>
      <span className="mt-1 text-[14px] font-semibold text-[var(--color-primary)]">{cta}</span>
    </Link>
  );
}
