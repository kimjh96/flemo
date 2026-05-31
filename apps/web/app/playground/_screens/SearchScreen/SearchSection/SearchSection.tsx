import type { PropsWithChildren } from "react";

export interface SearchSectionProps {
  title: string;
}

function SearchSection({ title, children }: PropsWithChildren<SearchSectionProps>) {
  return (
    <section className="flex flex-col">
      <h2 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-mute)]">
        {title}
      </h2>
      <div className="flex flex-col divide-y divide-[var(--color-line)]">{children}</div>
    </section>
  );
}

export default SearchSection;
