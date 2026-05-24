export interface NowPlayingProgressProps {
  elapsed: string;
  remaining: string;
  progress: number;
}

function NowPlayingProgress({ elapsed, remaining, progress }: NowPlayingProgressProps) {
  return (
    <div className="w-full">
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-text-primary)]/12">
        <div
          className="h-full rounded-full bg-[var(--color-text-primary)]/70"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-[var(--color-ink-mute)]">
        <span>{elapsed}</span>
        <span>−{remaining}</span>
      </div>
    </div>
  );
}

export default NowPlayingProgress;
