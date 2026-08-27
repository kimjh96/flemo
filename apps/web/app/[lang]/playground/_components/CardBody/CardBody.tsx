"use client";

import type { PropsWithChildren } from "react";

import { Part } from "@flemo/react";

import { useBench } from "../../_providers/BenchContext";

export interface CardBodyProps {
  className?: string;
}

// Contents of the card that are not paired with anything on the other side.
//
// Under the container transform they run the `card-body` part transition, which
// keeps them out of the frame while the card is a box in flight. Under every
// other case the card is a plain box, the whole screen is moving as one, and
// this is an ordinary div: a part transition there would run on a clock the
// flight is not running, which is the desync this page was rebuilt to avoid.
function CardBody({ className, children }: PropsWithChildren<CardBodyProps>) {
  const { morph } = useBench();

  if (morph !== "zoom") return <div className={className}>{children}</div>;

  return (
    <Part name="card-body" className={className}>
      {children}
    </Part>
  );
}

export default CardBody;
