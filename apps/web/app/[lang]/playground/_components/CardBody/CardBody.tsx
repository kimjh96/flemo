"use client";

import type { PropsWithChildren } from "react";

import { Part } from "@flemo/react";

import { DETAIL_CHROME } from "../../_transitions/detailChrome";

import { useBench } from "../../_providers/BenchContext";

export interface CardBodyProps {
  className?: string;
  // Which of the card's two clocks this content runs on. Copy arrives late and
  // leaves early, so the box travels bare. Chrome arrives late and leaves LATE,
  // because it is a fixed size and would swamp the card at cell size, but
  // blinking it out at the start of a pop reads as the screen losing it.
  as?: "copy" | "chrome";
}

// Contents of the card that are not paired with anything on the other side.
//
// Under the container transform they run the `card-body` part transition, which
// keeps them out of the frame while the card is a box running. Under every
// other case the card is a plain box, the whole screen is moving as one, and
// COPY is an ordinary div: a part transition there would run on a clock the
// transition is not running, which is the desync this page was rebuilt to avoid.
//
// CHROME is the exception, and it is one on both sides of that argument. The
// artwork still moves alone under those cases, the transition layer paints above
// the whole screen, and the z-10 header overlays the artwork's top edge — so
// the header is covered for the transition and revealed WHOLE at the landing,
// which is the flash reported on fade-through. Chrome therefore always runs a
// part; which one depends on whose transition covers it: the card's
// (`card-chrome`) when the card moves, and otherwise the per-transition clock
// from detailChrome.ts, which holds it back for exactly the artwork's transition
// and fades it in across the landing. That part is one part for every case now:
// it says `after: "transition"` and the transition answers with its own length.
function CardBody({ className, as = "copy", children }: PropsWithChildren<CardBodyProps>) {
  const { cardMorph } = useBench();

  if (cardMorph === null && as === "copy") return <div className={className}>{children}</div>;

  const name = cardMorph === null ? DETAIL_CHROME : as === "chrome" ? "card-chrome" : "card-body";

  return (
    <Part name={name} className={className}>
      {children}
    </Part>
  );
}

export default CardBody;
