"use client";

import type { PropsWithChildren } from "react";

import { Morph } from "@flemo/react";

import { useBench } from "../../_providers/BenchContext";

export interface CardShellProps {
  // The pairing key, or null where this box has no partner on the other side.
  // A morph with nothing to pair to is not a shared element, it is a promise
  // flemo cannot keep, so the null case renders an ordinary box.
  layoutId: string | null;
  className?: string;
}

// The card box, and whether it is a shared element at all depends on which case
// the bench is running. A container and an element are DIFFERENT CLAIMS, and
// the deleted playground had already learned the difference the hard way:
//
//   Shared.tsx (deleted in bdac70d)
//     "A shared element is a claim that two things ARE the same thing at two
//      sizes. The poster and the name are. The row and the page are not; they
//      are a container and its destination, which is the OTHER preset's job:
//      `zoom` is a container transform and pairing the box is precisely what it
//      means. So the container pairs on `zoom` only."
//
// and the symptom when it pairs on the others:
//
//     "Pairing the container asks flemo to carry one layout into the other, so
//      every intermediate frame is a stretched hybrid."
//
// So under `zoom` the whole card flies and becomes the page, which is what a
// container transform is. Under everything else this is a plain box and only
// the artwork inside it travels.
function CardShell({ layoutId, className, children }: PropsWithChildren<CardShellProps>) {
  const { cardMorph } = useBench();

  if (cardMorph === null || layoutId === null) return <div className={className}>{children}</div>;

  // The artwork inside pairs as well, and that is required rather than extra:
  // a nested morph RIDES its container, and letting the two fly on their own
  // curves is what tears a card apart mid-flight (see `attachMorph`).
  // `overflow: hidden` is what makes the growth READ as growth. flemo animates
  // the layout BOX and lets the subtree lay itself out at every size on the way
  // ("A box, not a scale ... text becomes a blown-up bitmap and the contents
  // cannot find their own places"), so the page's own type is at page size from
  // the first frame, inside a box still the size of a cell. Unclipped it spills
  // across the grid; clipped, the card reveals its contents as it makes room
  // for them.
  return (
    <Morph name={cardMorph} layoutId={layoutId} className={`overflow-hidden ${className ?? ""}`}>
      {children}
    </Morph>
  );
}

export default CardShell;
