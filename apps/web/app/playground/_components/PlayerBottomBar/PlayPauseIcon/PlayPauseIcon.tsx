export interface PlayPauseIconProps {
  playing: boolean;
}

function PlayPauseIcon({ playing }: PlayPauseIconProps) {
  if (playing) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <rect x="2.5" y="1.5" width="3" height="11" rx="0.5" fill="currentColor" />
        <rect x="8.5" y="1.5" width="3" height="11" rx="0.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 1.5L12 7L3 12.5V1.5Z" fill="currentColor" />
    </svg>
  );
}

export default PlayPauseIcon;
