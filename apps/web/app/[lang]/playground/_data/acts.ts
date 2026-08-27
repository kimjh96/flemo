export interface Act {
  id: string;
  artist: string;
  venue: string;
  day: string;
  time: string;
  price: string;
  hue: number;
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
    hue: 222
  },
  {
    id: "mono-lake",
    artist: "Mono Lake",
    venue: "The Annex",
    day: "Sat",
    time: "21:00",
    price: "32,000",
    hue: 172
  },
  {
    id: "hue-and-cry",
    artist: "Hue & Cry",
    venue: "Rooftop Five",
    day: "Sun",
    time: "17:00",
    price: "29,000",
    hue: 316
  },
  {
    id: "nightform",
    artist: "Nightform",
    venue: "Warehouse 3",
    day: "Thu",
    time: "20:00",
    price: "35,000",
    hue: 44
  },
  {
    id: "violet-hour",
    artist: "Violet Hour",
    venue: "Blue Room",
    day: "Fri",
    time: "19:00",
    price: "27,000",
    hue: 268
  },
  {
    id: "second-sun",
    artist: "Second Sun",
    venue: "St. Mark's",
    day: "Sat",
    time: "22:00",
    price: "41,000",
    hue: 8
  }
];

export const actById = (id: string | undefined): Act | undefined =>
  ACTS.find((act) => act.id === id);

// A flat gradient rather than a photograph, and that is a measurement rather
// than a taste: an image finishing its decode mid-flight rasters on the moving
// layer and costs a present. `@flemo/devtools` reports it as the warm-side
// image-hold regression; a stage being judged should not manufacture one.
export const artworkFor = (hue: number): string =>
  `linear-gradient(155deg, hsl(${hue} 80% 62%), hsl(${(hue + 42) % 360} 70% 44%))`;
