export interface Album {
  id: string;
  title: string;
  artist: string;
  year: number;
  hue: number;
  tracks: Track[];
}

export interface Track {
  id: string;
  title: string;
  duration: string;
  albumId: string;
}

const make = (
  id: string,
  title: string,
  artist: string,
  year: number,
  hue: number,
  tracks: Array<[string, string]>
): Album => ({
  id,
  title,
  artist,
  year,
  hue,
  tracks: tracks.map(([trackTitle, duration], index) => ({
    id: `${id}-${index + 1}`,
    title: trackTitle,
    duration,
    albumId: id
  }))
});

export const albums: Album[] = [
  make("solace", "Solace", "Eun Park", 2024, 212, [
    ["Long Quiet", "3:24"],
    ["Across the River", "4:01"],
    ["Slow Burn", "2:58"],
    ["Letters Home", "3:46"],
    ["Solace", "5:12"]
  ]),
  make("kinetic", "Kinetic", "Daiki & The Hours", 2023, 18, [
    ["Crossing", "3:11"],
    ["Sodium", "4:33"],
    ["Wires", "2:46"],
    ["No Closer", "4:08"],
    ["Kinetic", "5:30"]
  ]),
  make("paper-streets", "Paper Streets", "Mira Roe", 2024, 142, [
    ["Cardstock", "3:51"],
    ["Folded Map", "3:09"],
    ["Stamped", "4:22"],
    ["Origami", "2:54"],
    ["Paper Streets", "4:45"]
  ]),
  make("glow", "Glow", "Antares Choir", 2022, 282, [
    ["Embers", "4:11"],
    ["Halo", "3:47"],
    ["Lighthouse", "5:02"],
    ["Glow", "6:18"]
  ]),
  make("dust-clock", "Dust Clock", "Jeong-A Kim", 2024, 340, [
    ["Sand", "3:22"],
    ["Tick", "2:58"],
    ["The Hour", "4:14"],
    ["Dust Clock", "5:01"],
    ["After Six", "3:39"]
  ]),
  make("monsoon", "Monsoon Hours", "Ren & Vega", 2023, 198, [
    ["First Drops", "3:08"],
    ["Floodline", "3:54"],
    ["Verandah", "4:27"],
    ["Monsoon", "5:11"]
  ])
];

export const albumById = (id: string): Album | undefined => albums.find((album) => album.id === id);
