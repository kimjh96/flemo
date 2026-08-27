"use client";

import { createElement, type ComponentPropsWithoutRef, type JSX } from "react";

import { Morph, type MorphTransitionName } from "@flemo/react";

import { useMotionChoice, type MorphCase } from "../../_providers/MotionChoiceContext";

export interface SharedProps extends ComponentPropsWithoutRef<"div"> {
  layoutId: string;
  /** Overrides the bench's morph preset — type inside a card runs `text`. */
  name?: MorphTransitionName;
  as?: keyof JSX.IntrinsicElements;
  /**
   * Which morph presets should pair THIS element. Defaults to all of them.
   *
   * It exists because a container and an element are different claims. See the
   * note below.
   */
  pairFor?: MorphCase["id"][];
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
// WHY `pairFor` EXISTS — a correction, and a real distinction between the two
// morph presets rather than a workaround.
//
// The first version paired three things on every preset: the row CONTAINER, the
// poster inside it, and the title inside that. On `shared` that produced a
// visible mess, and the frames say exactly why: a list row is
// [thumb | name | price] laid out across, and the detail is [hero] then [name]
// then [meta] laid out down. Pairing the container asks flemo to carry one
// layout into the other, so every intermediate frame is a stretched hybrid —
// and the price, which exists only on the list side and is paired with nothing,
// rides along smeared across the detail's poster.
//
// A shared element is a claim that two things ARE the same thing at two sizes.
// The poster and the name are. The row and the page are not; they are a
// container and its destination, which is the OTHER preset's job — `zoom` is a
// container transform and pairing the box is precisely what it means.
//
// So the container pairs on `zoom` only, and the copy that says the poster and
// the name "are the same two elements that were in the list" is now true.
//
// Note what is NOT here: a duration. A morph resolves its length as the flying
// screen's (`attachMorph`: `enterMotion.options.duration ?? side.screenDuration`),
// so the element lands with its screen under every preset without this file
// knowing which one is running. The <Part>s elsewhere in this folder need a
// generated clock precisely because they do not get that.
function Shared({ layoutId, name, as = "div", pairFor, ...props }: SharedProps) {
  const { morph } = useMotionChoice();
  // An audit marker, not a runtime input. flemo keeps the pairing key in JS
  // rather than on the element, and the flight audit needs to tell DIFFERENT
  // pairs apart from the two sides of ONE pair -- which are superimposed on
  // purpose, since that is how the cross-fade trades them over. A ghost is a
  // clone, so it carries this and is excluded for free.
  const marked = { ...props, "data-morph-pair": layoutId };

  // The bench's switch decides whether anything is shared at all; a per-element
  // `name` only chooses WHICH preset once it is. Reading the override first
  // would leave nested type morphing on a bench with the element switched off.
  if (!morph.name) return createElement(as, props);
  if (pairFor && !pairFor.includes(morph.id)) return createElement(as, props);

  return <Morph layoutId={layoutId} name={name ?? morph.name} as={as} {...marked} />;
}

export default Shared;
