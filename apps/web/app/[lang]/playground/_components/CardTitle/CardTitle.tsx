"use client";

import type { PropsWithChildren } from "react";

import { Morph } from "@flemo/react";

import { useBench } from "../../_providers/BenchContext";

export interface CardTitleProps {
  layoutId: string | null;
  className?: string;
}

// The act's name, paired wherever the card around it is paired.
//
// It has to be, and a recording showed why. Under the container transform the
// card carries a GHOST, which is a copy of the departing side dissolving into
// the arriving one:
//
//   typing.ts, on crossFade
//     "the flight begins as an exact copy of what was on glass and dissolves
//      into the real arriving element while the box moves"
//
// Everything unpaired INSIDE that card therefore exists twice for the length of
// the dissolve: once in the ghost at the cell's size, once in the arrival at
// the page's size, at different places. On the recording the act's name and its
// line of meta were legibly doubled through the whole flight.
//
// A paired element is lifted out of BOTH sides, so it appears in neither copy
// and travels once. The deleted playground had this and this session dropped
// it; the file that introduced it named the reason:
//
//   Shared.tsx (deleted in bdac70d)
//     "A shared element is a claim that two things ARE the same thing at two
//      sizes. The poster and the name are."
//
// `text` is the preset for type: it scales by the LINE BOX rather than the
// element's width, so a 13px label and a 24px heading are the same words at two
// sizes rather than a stretched box, and it carries no ghost of its own.
function CardTitle({ layoutId, className, children }: PropsWithChildren<CardTitleProps>) {
  const { morph } = useBench();

  // Only under the container transform, because only there is there a card
  // ghost to be doubled inside. Under the other cases the name is ordinary
  // content on a screen that is moving as a whole.
  if (morph !== "zoom" || layoutId === null) return <span className={className}>{children}</span>;

  return (
    <Morph as="span" name="text" layoutId={layoutId} className={className}>
      {children}
    </Morph>
  );
}

export default CardTitle;
