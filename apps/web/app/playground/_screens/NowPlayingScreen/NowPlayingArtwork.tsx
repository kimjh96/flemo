import { gradientFor } from "@/app/playground/_data/gradient";

export interface NowPlayingArtworkProps {
  hue: number;
  title: string;
  artist: string;
}

function NowPlayingArtwork({ hue, title, artist }: NowPlayingArtworkProps) {
  return (
    <>
      <div
        className="aspect-square w-[78%] rounded-2xl shadow-[0_24px_60px_-20px_rgba(15,19,27,0.4)]"
        style={{ background: gradientFor(hue) }}
      />
      <div className="w-full text-center">
        <div className="text-2xl font-bold text-[var(--color-text-primary)]">{title}</div>
        <div className="text-sm text-[var(--color-ink-soft)]">{artist}</div>
      </div>
    </>
  );
}

export default NowPlayingArtwork;
