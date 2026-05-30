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
  ]),
  make("northbound", "Northbound", "Sora Lim", 2024, 230, [
    ["Westgate", "3:18"],
    ["Old Highway", "4:02"],
    ["Pine Mile", "3:44"],
    ["Northbound", "5:21"]
  ]),
  make("fade-room", "Fade Room", "Owen Hart", 2022, 0, [
    ["Drape", "3:02"],
    ["Halflight", "3:48"],
    ["Glass Door", "4:15"],
    ["Fade Room", "4:59"]
  ]),
  make("citrine", "Citrine", "Naomi Vale", 2023, 52, [
    ["Quartz", "3:33"],
    ["Citrine", "4:11"],
    ["Topaz", "2:51"],
    ["Garnet", "4:46"],
    ["Opal", "3:27"]
  ]),
  make("low-tide", "Low Tide", "Hira Ko", 2024, 184, [
    ["Bayline", "3:55"],
    ["Sandbar", "4:21"],
    ["Driftwood", "3:08"],
    ["Low Tide", "5:33"]
  ]),
  make("vellum", "Vellum", "Ito & Sun", 2022, 32, [
    ["Inks", "3:14"],
    ["Margin Notes", "4:02"],
    ["Vellum", "5:00"],
    ["Quill", "3:46"]
  ]),
  make("orbit-room", "Orbit Room", "The Helios Set", 2023, 252, [
    ["Apogee", "3:38"],
    ["Perigee", "4:09"],
    ["Drift", "3:21"],
    ["Orbit Room", "5:44"],
    ["Reentry", "4:02"]
  ]),
  make("amber-line", "Amber Line", "Eun Park", 2022, 36, [
    ["Departure", "3:48"],
    ["Tunnel", "2:55"],
    ["Junction", "4:11"],
    ["Amber Line", "5:08"]
  ]),
  make("hush", "Hush", "Mira Roe", 2023, 320, [
    ["Soft Open", "3:02"],
    ["Hush", "4:38"],
    ["Linen", "3:21"],
    ["Curtain Call", "4:51"]
  ]),
  make("midcoast", "Midcoast", "Daiki & The Hours", 2024, 168, [
    ["Marlin", "3:44"],
    ["Cove", "4:18"],
    ["Pier 9", "3:02"],
    ["Midcoast", "5:25"],
    ["Lantern", "3:50"]
  ]),
  make("sodalight", "Sodalight", "Antares Choir", 2024, 268, [
    ["Pylon", "3:33"],
    ["Mercury", "4:07"],
    ["Sodalight", "5:14"],
    ["Stations", "3:58"]
  ]),
  make("after-rain", "After Rain", "Ren & Vega", 2024, 156, [
    ["Petrichor", "3:11"],
    ["Slow Drain", "4:24"],
    ["Eaves", "3:46"],
    ["After Rain", "5:02"],
    ["Steam", "3:18"]
  ]),
  make("paper-moon", "Paper Moon", "Jeong-A Kim", 2023, 48, [
    ["Lantern Festival", "3:55"],
    ["Folded", "3:21"],
    ["Paper Moon", "5:33"],
    ["Tide Pool", "4:09"]
  ])
];

export const albumById = (id: string): Album | null =>
  albums.find((album) => album.id === id) ?? null;
