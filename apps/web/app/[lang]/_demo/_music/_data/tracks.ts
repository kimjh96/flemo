// Demo content for the music mini-app, a fresh lightweight second demo (not the
// old playground). Track and artist names are proper nouns, the same in both
// locales; only the small chrome labels are localized. Hues are decorative demo
// artwork, not shiflo tokens.
export interface Track {
  id: string;
  title: string;
  artist: string;
  hue: number;
}

export const TRACKS: Track[] = [
  { id: "1", title: "Glass Morning", artist: "Aria Wave", hue: 212 },
  { id: "2", title: "Slow Tide", artist: "Mono Lake", hue: 168 },
  { id: "3", title: "Paper Planes", artist: "Hue & Cry", hue: 280 },
  { id: "4", title: "Velvet Static", artist: "Nightform", hue: 24 },
  { id: "5", title: "Soft Focus", artist: "Aria Wave", hue: 320 }
];

export function trackById(id: string): Track | undefined {
  return TRACKS.find((track) => track.id === id);
}

// A soft two-stop gradient for the artwork, derived from the track hue.
export function artworkFor(hue: number): string {
  return `linear-gradient(145deg, hsl(${hue} 75% 62%), hsl(${(hue + 40) % 360} 70% 52%))`;
}

interface MusicCopy {
  title: string;
  subtitle: string;
  nowPlaying: string;
}

const COPY: Record<string, MusicCopy> = {
  en: { title: "Music", subtitle: "Recently played", nowPlaying: "Now playing" },
  ko: { title: "뮤직", subtitle: "최근 재생", nowPlaying: "재생 중" }
};

export function musicCopy(lang: string): MusicCopy {
  return COPY[lang] ?? COPY.en;
}
