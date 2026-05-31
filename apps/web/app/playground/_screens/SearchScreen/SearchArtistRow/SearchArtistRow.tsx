export interface SearchArtistRowProps {
  name: string;
  hue: number;
}

function SearchArtistRow({ name, hue }: SearchArtistRowProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex w-full items-center gap-3 py-2">
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
        style={{ background: `hsl(${hue}, 55%, 55%)` }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
          {name}
        </div>
        <div className="text-[12px] text-[var(--color-ink-soft)]">Artist</div>
      </div>
    </div>
  );
}

export default SearchArtistRow;
