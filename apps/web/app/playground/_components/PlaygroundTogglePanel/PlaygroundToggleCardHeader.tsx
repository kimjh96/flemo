export interface PlaygroundToggleCardHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

function PlaygroundToggleCardHeader({
  eyebrow,
  title,
  description
}: PlaygroundToggleCardHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="kicker">{eyebrow}</span>
      <h3 className="text-[18px] font-bold leading-tight tracking-[-0.01em] text-[var(--color-text-primary)]">
        {title}
      </h3>
      <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
        {description}
      </p>
    </div>
  );
}

export default PlaygroundToggleCardHeader;
