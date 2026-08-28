"use client";

import type { PropsWithChildren } from "react";

import { Morph } from "@flemo/react";

import { useBench } from "../../_providers/BenchContext";

export interface CardTitleProps {
  layoutId: string | null;
  className?: string;
}

// The act's name, paired as a `text` morph across the container transform —
// exactly what the deleted playground did, and for the same reason. Both ends
// of the card show the name; unpaired, it is drawn twice (once in the ghost at
// cell size, once in the arrival at page size). Paired, it is LIFTED out of
// both sides and re-typesets from label to heading, and the clone left in its
// place holds its exact box, so the line under it never moves.
function CardTitle({ layoutId, className, children }: PropsWithChildren<CardTitleProps>) {
  const { cardMorph } = useBench();

  if (cardMorph === null || layoutId === null) return <span className={className}>{children}</span>;

  return (
    <Morph as="span" name="text" layoutId={layoutId} className={className}>
      {children}
    </Morph>
  );
}

export default CardTitle;
