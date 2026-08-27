// ONE APP, three routes through it.
//
// The previous playground ran three unrelated fixtures — a "Gallery" of colour
// swatches, a five-screen stack whose screens were called "Screen A · cupertino",
// and a full-screen overlay harness in blue and yellow. Each was legible on its
// own and none of them was an app, so the page read as three demos rather than
// one thing being examined three ways.
//
// This is the app: a ticket app for the acts the landing page's music demo is
// playing. Same fictional world, one step further along — which is also why the
// artists are the hero demo's artists.
//
// It earns its keep beyond looking real. A booking flow is genuinely five
// screens deep in a real product, so the stack case is a stack a visitor
// recognises rather than five letters; a poster is genuinely small in a list and
// large on a detail screen, so the shared element has somewhere real to travel;
// and a seat picker is genuinely an overlay over a tab bar, which is the exact
// arrangement the layering case exists to judge.
export interface Act {
  id: string;
  artist: string;
  venue: string;
  day: string;
  time: string;
  price: string;
  /** Drives the poster gradient. See `posterFor`. */
  hue: number;
}

// Flat gradients rather than photographs, and this one IS a measurement rather
// than a preference: an image decode lands in the middle of the frames a morph
// is judged on. The site's own showcase records a ~110ms decode block on entry
// that was accepted as a cost there; a judging stage cannot accept it, because
// here the frames ARE the result.
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

export const posterFor = (hue: number): string =>
  `linear-gradient(155deg, hsl(${hue} 80% 62%), hsl(${(hue + 42) % 360} 70% 44%))`;
