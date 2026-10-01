export interface Act {
  id: string;
  artist: string;
  venue: string;
  day: string;
  time: string;
  price: string;
  hue: number;
  // The booking reference the tickets tab prints on the stub. It is data rather
  // than something derived from the id, so the two tabs cannot drift apart.
  order: string;
}

// The same fictional acts the landing hero's music demo plays, one step further
// along: the app that sells you a ticket to them.
export const ACTS: Act[] = [
  {
    id: "aria-wave",
    artist: "Aria Wave",
    venue: "Pier 24",
    day: "Fri",
    time: "20:00",
    price: "38,000",
    hue: 222,
    order: "7QX31"
  },
  {
    id: "mono-lake",
    artist: "Mono Lake",
    venue: "The Annex",
    day: "Sat",
    time: "21:00",
    price: "32,000",
    hue: 172,
    order: "2ND84"
  },
  {
    id: "hue-and-cry",
    artist: "Hue & Cry",
    venue: "Rooftop Five",
    day: "Sun",
    time: "17:00",
    price: "29,000",
    hue: 316,
    order: "8LMV6"
  },
  {
    id: "nightform",
    artist: "Nightform",
    venue: "Warehouse 3",
    day: "Thu",
    time: "20:00",
    price: "35,000",
    hue: 44,
    order: "5RT07"
  },
  {
    id: "violet-hour",
    artist: "Violet Hour",
    venue: "Blue Room",
    day: "Fri",
    time: "19:00",
    price: "27,000",
    hue: 268,
    order: "3WZ52"
  },
  {
    id: "second-sun",
    artist: "Second Sun",
    venue: "St. Mark's",
    day: "Sat",
    time: "22:00",
    price: "41,000",
    hue: 8,
    order: "9HB48"
  },
  {
    id: "paper-planes",
    artist: "Paper Planes",
    venue: "Warehouse 3",
    day: "Sun",
    time: "19:00",
    price: "33,000",
    hue: 194,
    order: "1CJ63"
  },
  {
    id: "low-tide",
    artist: "Low Tide",
    venue: "Pier 24",
    day: "Thu",
    time: "21:00",
    price: "30,000",
    hue: 138,
    order: "6PY25"
  },
  {
    id: "glass-morning",
    artist: "Glass Morning",
    venue: "Blue Room",
    day: "Sat",
    time: "18:00",
    price: "26,000",
    hue: 288,
    order: "0KA79"
  },
  {
    id: "velvet-static",
    artist: "Velvet Static",
    venue: "Rooftop Five",
    day: "Fri",
    time: "22:00",
    price: "37,000",
    hue: 24,
    order: "4F2K9"
  }
];

export const actById = (id: string | undefined): Act | undefined =>
  ACTS.find((act) => act.id === id);

// CSS artwork stays available on the first frame of a Morph flight. An image
// decoded mid-flight would re-raster the moving layer and add a visible hitch.
export const artworkFor = (hue: number): string =>
  [
    "repeating-linear-gradient(132deg, transparent 0 18px, rgb(255 255 255 / 0.045) 19px 20px)",
    `radial-gradient(circle at 68% 24%, hsl(${(hue + 90) % 360} 95% 82% / 0.8), transparent 35%)`,
    `radial-gradient(ellipse at 20% 85%, hsl(${(hue + 260) % 360} 85% 30% / 0.8), transparent 55%)`,
    `linear-gradient(150deg, hsl(${hue} 82% 62%), hsl(${(hue + 45) % 360} 72% 35%))`
  ].join(", ");
