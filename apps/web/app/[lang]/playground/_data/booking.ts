import type { MorphTransitionName, TransitionName } from "@flemo/react";

// THE BOOKING FLOW: one stack, five pushes, a different transition on each.
//
// The transitions case answers "does this transition work". This answers the
// question only a stack can: whether a flight leaves anything behind for the
// next one to trip on, and whether five pops unwind five different transitions
// in the right order.
//
// The steps are a real booking flow rather than five letters, and the order is
// not arbitrary — each transition is placed where a real app would place it:
//
//   event    cupertino  a push into detail, the platform's own gesture
//   seats    sheet      picking something modal, opening over what you were on
//   extras   material   a plain forward step
//   review   fade       a summary, where nothing should move but the content
//   done     layout     a terminal screen, where the ticket is the whole event
//
// Two of them carry a morph, so a morph flight is followed by a non-morph one
// and vice versa. That adjacency is the point: a residue left by a morph shows
// up as the NEXT transition misbehaving, not as the morph misbehaving.
export interface BookingStep {
  id: string;
  /** The transition that PUSHES to this step, and pops back out of it. */
  transitionName: TransitionName;
  /** Set when this step arrives by morph: the preset the shared element runs. */
  morphName?: MorphTransitionName;
  /** Whether the shared element covers this screen edge to edge. */
  fullBleed?: boolean;
}

export const BOOKING: BookingStep[] = [
  // The bottom of the stack. Nothing pushes TO it, so its transition name is
  // never used; it exists so the FIRST push in the flow is a real one. Without
  // it `cupertino` would only ever be the initial screen's rest state, which is
  // not the thing being tested.
  { id: "tonight", transitionName: "none" },
  { id: "event", transitionName: "cupertino", morphName: "shared" },
  { id: "seats", transitionName: "sheet", fullBleed: true },
  { id: "extras", transitionName: "material" },
  { id: "review", transitionName: "fade" },
  { id: "done", transitionName: "layout", morphName: "zoom" }
];

export const stepAt = (id: string | undefined): { step: BookingStep; index: number } | null => {
  const index = BOOKING.findIndex((entry) => entry.id === id);
  return index < 0 ? null : { step: BOOKING[index]!, index };
};
