"use client";

import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";

export interface SearchAppBarProps {
  query: string;
  onChange: (next: string) => void;
}

function SearchAppBar({ query, onChange }: SearchAppBarProps) {
  const dict = usePlaygroundDict();
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <header className="flex flex-col gap-3 bg-[var(--color-surface)] px-5 pb-3 pt-4">
      <h1 className="text-[26px] font-bold tracking-tight text-[var(--color-text-primary)]">
        {dict.tabBar.search}
      </h1>
      <input
        type="search"
        value={query}
        onChange={handleChange}
        placeholder={dict.search.placeholder}
        className="w-full rounded-full border border-[var(--color-line)] bg-[var(--color-layer)] px-4 py-2 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-ink-mute)] focus:outline-none focus:border-[var(--color-brand)]"
      />
    </header>
  );
}

export default SearchAppBar;
