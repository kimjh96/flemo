export interface ShowcasePageHeaderProps {
  kicker: string;
  title: string;
  subtitle: string;
}

export default function ShowcasePageHeader({ kicker, title, subtitle }: ShowcasePageHeaderProps) {
  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-layer)]">
      <div className="mx-auto max-w-[1240px] px-6 py-20 sm:py-24">
        <span className="kicker">{kicker}</span>
        <h1 className="mt-4 max-w-[18ch] text-balance text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-[56px]">
          {title}
        </h1>
        <p className="mt-5 max-w-[56ch] text-[17px] leading-[1.6] text-[var(--color-text-secondary)]">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
