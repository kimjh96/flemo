"use client";

import { posterFor, type Act } from "../../_data/tonight";

import Shared from "../Shared";

export interface PosterProps {
  act: Act;
  /**
   * Where this poster is. A shared element is the SAME element at two sizes,
   * so the two sites differ by class name and nothing else — no wrapper, no
   * flag reaching the morph, no branch inside <Shared>.
   */
  place: "hero" | "tile" | "thumb";
}

// The two ends of the pair, and they are deliberately the SAME SHAPE at two
// sizes. An earlier version made the list a horizontal row -- a 48px square
// beside the text -- against a detail whose hero sits ABOVE the text. Morphing
// between those is not a scale, it is a rearrangement: the poster grew 14x
// while the title had to cross over it to get from beside-the-thumb to
// below-the-hero, and every mid-flight frame had the title dumped on top of the
// poster. Same aspect, same stacking order, different size: now it is a move.
const SHAPE = {
  hero: "block aspect-[4/3] w-full",
  tile: "block aspect-[4/3] w-full rounded-xl",
  // The Tickets tab, where nothing is paired: no flight starts from that list,
  // so its poster is free to be whatever shape suits the row. The constraint
  // above is about the PAIR, not about posters in general.
  thumb: "block size-12 shrink-0 rounded-lg"
} as const;

// The act's poster, paired across a flight.
//
// A flat gradient rather than a photograph, and that is a measurement rather
// than a taste: an image decode lands in the middle of the exact frames a morph
// is judged on, so a judging stage cannot afford one. (The site's showcase
// accepted a ~110ms decode block on entry because nothing there is being timed.
// Here the frames are the result.)
function Poster({ act, place }: PosterProps) {
  return (
    <Shared
      layoutId={`poster-${act.id}`}
      as="span"
      className={SHAPE[place]}
      style={{ background: posterFor(act.hue) }}
      aria-hidden="true"
    />
  );
}

export default Poster;
