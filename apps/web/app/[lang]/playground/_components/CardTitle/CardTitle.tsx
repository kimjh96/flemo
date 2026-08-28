"use client";

import type { PropsWithChildren } from "react";

import { Morph } from "@flemo/react";

export interface CardTitleProps {
  layoutId: string | null;
  className?: string;
}

// The act's name, paired as a `text` morph — on EVERY case, not only the
// container transform. Both ends show the same name, and that makes it a
// shared element by the definition this bench keeps quoting: a claim that two
// things ARE the same thing at two sizes. Paired, it is LIFTED out of both
// sides and re-typesets from label to heading on the flying transition's own
// clock, and the clone left in its place holds its exact box, so the line
// under it never moves.
//
// It used to pair under `zoom` only, on the reading that the reference recipe
// belonged to the container transform — but a text morph is an independent
// flight and composes with any screen transition exactly the way the artwork
// does. The user asked why the title only morphed under zoom; the answer was
// "this gate", so the gate is gone.
function CardTitle({ layoutId, className, children }: PropsWithChildren<CardTitleProps>) {
  if (layoutId === null) return <span className={className}>{children}</span>;

  return (
    <Morph as="span" name="text" layoutId={layoutId} className={className}>
      {children}
    </Morph>
  );
}

export default CardTitle;
