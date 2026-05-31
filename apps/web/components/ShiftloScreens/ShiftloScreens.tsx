export interface ShiftloScreensProps {
  screens: { src: string; alt: string }[];
}

export default function ShiftloScreens({ screens }: ShiftloScreensProps) {
  return (
    <div className="-mx-2 flex snap-x gap-4 overflow-x-auto px-2 py-2">
      {screens.map((screen) => (
        <img
          key={screen.src}
          src={screen.src}
          alt={screen.alt}
          width={1320}
          height={2868}
          className="h-auto w-44 shrink-0 snap-start rounded-2xl border border-[var(--color-border-light)] sm:w-52"
          loading="lazy"
        />
      ))}
    </div>
  );
}
