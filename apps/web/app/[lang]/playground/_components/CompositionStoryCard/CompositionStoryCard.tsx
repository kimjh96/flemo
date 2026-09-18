"use client";

import { Morph, Part } from "@flemo/react";

import CardTitle from "../CardTitle";

export interface CompositionStoryCardProps {
  paired: boolean;
  variant: "preview" | "detail";
}

const SHELL_ID = "composition-featured";
const TITLE_ID = "composition-featured-title";

// WHAT IS SHARED GOES IN THE BOX; WHAT IS NOT GOES BESIDE IT.
//
// The panel is one object on both screens and the title is one line of type on
// both, so those are the identity the flight carries: a Morph for the box, a
// text Morph for the line. The eyebrow and the summary are DIFFERENT SENTENCES
// at the two ends — "Today" against "Message 42" — and a Morph asserts one
// identity, so they are not the flight's to carry.
//
// They used to be inside it anyway, and the card paid for that twice. The ghost
// follows the arriving box by one transform, so unshared copy it carried
// stretched with the box and printed over the arrival's own words; the mitigation
// was to cut the hand-over to 0.13s of a 0.7s flight, which reads as the copy
// being switched off and the card travelling empty for the rest. Beside the box
// there is nothing to stretch and nothing to print over, so the two sentences
// hand over on the screen's own clock, for as long as the screen takes.
function CompositionStoryCard({ paired, variant }: CompositionStoryCardProps) {
  const detail = variant === "detail";
  // NOTHING PAINTS AGAINST THE BOX THAT CHANGES SIZE.
  //
  // A container Morph animates its box, so everything painted against that box
  // is rastered again on every frame of the flight, and everything inside it is
  // laid out again with it. Measured here on the flight's steady middle: the
  // gradient cost 0.26ms a frame and the blurred violet shadow 0.38ms, against
  // 0.08ms with neither — two thirds of a frame's raster on a 120Hz budget of
  // 8.3ms, every frame, for paint nobody asked to animate. The playground's own
  // card paints neither on its morphing box, which is why that bench holds its
  // frame rate where this one did not.
  //
  // A flat fill is also the only paint a REVEAL can hold: a box whose contents
  // stay put is laid out once at the larger end and clipped into view, and a
  // gradient or a shadow laid out once at the larger end is a different picture
  // at every size before it (see morphReveal). With the fill flat, this card
  // takes that path and stops laying its subtree out at every size.
  const panel = detail
    ? "relative block min-h-[196px] overflow-hidden rounded-[30px] bg-violet-600 p-5 text-white"
    : "relative block min-h-[104px] overflow-hidden rounded-[24px] bg-violet-600 p-4 text-white";

  const shell = (
    <div className={detail ? "flex min-h-[156px] items-end" : "flex min-h-[72px] items-end"}>
      <div className={detail ? "h-10 w-full" : "h-7 w-full"}>
        <CardTitle
          layoutId={paired ? TITLE_ID : null}
          className={
            detail
              ? "block truncate text-[30px] leading-10 font-black tracking-[-0.04em] text-white"
              : "block truncate text-xl leading-7 font-black tracking-[-0.03em] text-white"
          }
        >
          Morning brief
        </CardTitle>
      </div>
    </div>
  );

  // SPACING IS PADDING, NOT A MARGIN ON THE PART'S CHILD.
  //
  // A Part carries `contain: layout` while its screen is moving, and that stops
  // a child's margin collapsing out of it. So a paragraph spaced by `mt-*`
  // inside a Part sits in one place while the flight runs and moves by exactly
  // that margin when the status settles and the containment is dropped —
  // measured here as the summary falling 12px some 60ms AFTER the card landed,
  // which is the late drop at the end of the convergence. Padding does not
  // collapse, so the box is the same whether the screen is moving or at rest.
  return (
    <div className="block text-left">
      <Part name="composition-card-copy" className={detail ? "block pb-2" : "block pb-1"}>
        <p className="text-[9px] font-bold tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">
          {detail ? "Message 42" : "Today"}
        </p>
      </Part>

      {paired ? (
        <Morph name="composition-card-shell" layoutId={SHELL_ID} className={panel}>
          {shell}
        </Morph>
      ) : (
        <div className={panel}>{shell}</div>
      )}

      <Part name="composition-card-copy" className={detail ? "block pt-3" : "block pt-2"}>
        <p
          className={`${detail ? "text-[13px]" : "text-[11px]"} text-slate-600 dark:text-slate-300`}
        >
          {detail
            ? "One story, continued from the workspace card."
            : "Open the story without leaving the app shell."}
        </p>
      </Part>
    </div>
  );
}

export default CompositionStoryCard;
