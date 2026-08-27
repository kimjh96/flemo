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
  place: "hero" | "thumb";
}

const SHAPE = {
  hero: "block aspect-[4/3] w-full",
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
