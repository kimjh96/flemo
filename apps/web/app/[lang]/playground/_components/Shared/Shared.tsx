"use client";

import { createElement, type ComponentPropsWithoutRef, type JSX } from "react";

import { Morph, type MorphTransitionName } from "@flemo/react";

import { useMotionChoice } from "../../_providers/MotionChoiceContext";

export interface SharedProps extends ComponentPropsWithoutRef<"div"> {
  layoutId: string;
  /** Overrides the bench's morph preset — type inside a poster runs `text`. */
  name?: MorphTransitionName;
  as?: keyof JSX.IntrinsicElements;
}

// The same box, with or without the shared element.
//
// The bench can turn morphing off, and what has to be left behind is an
// ORDINARY screen transition on ordinary markup — not a degraded morph. So this
// renders a plain element in that mode: no layer, no pairing, no flight, and no
// screen in the app branching on which mode it is in.
//
// It is also the honest shape for a consumer to copy. `<Morph>` is a box that
// happens to be paired; swapping it for the tag it was pretending to be should
// change nothing else about the markup, and here it does not.
//
// Note what is NOT here: a duration. A morph resolves its length as the flying
// screen's (`attachMorph`: `enterMotion.options.duration ?? side.screenDuration`),
// so the element lands with its screen under every preset without this file
// knowing which one is running. The <Part>s elsewhere in this folder need a
// generated clock precisely because they do not get that.
function Shared({ layoutId, name, as = "div", ...props }: SharedProps) {
  const { morph } = useMotionChoice();

  // The bench's switch decides whether anything is shared at all; a per-element
  // `name` only chooses WHICH preset once it is. Reading the override first
  // would leave nested type morphing on a bench with the element switched off.
  if (!morph.name) return createElement(as, props);

  return <Morph layoutId={layoutId} name={name ?? morph.name} as={as} {...props} />;
}

export default Shared;
