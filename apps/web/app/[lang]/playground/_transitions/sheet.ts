"use client";

import { createTransition } from "@flemo/react";

import { SHEET_EASE, SHEET_IN, SHEET_OUT } from "./sheet.constants";

import "./sheet.types";

// A modal sheet: the detail rises from the bottom edge over the list, and the
// list recedes a step behind it. It replaces `fade-through` on this bench —
// the sequenced fades read as the stage blinking dark between screens, and
// every complaint filed against the case was about that gap. A sheet covers
// the same ground (an authored transition that is neither a lateral slide nor
// a zoom) with a gesture every phone user already knows.
//
// The shared element still flies: a morph composes with a screen slide the
// same way it does under cupertino, since the flight runs in the layer and
// only borrows this transition's clock. (`zoom` is the one that must not pair
// with a slide, and it carries its own still partner.)
//
// Asymmetric on purpose, like material: presenting a sheet is an entrance
// worth 0.42s; dismissing one is a confirmation and gets 0.34s. The receding
// list scales rather than fading — two opaque screens at partial opacity
// double-expose, which is the lesson `layout` already recorded.
const sheet = createTransition({
  name: "sheet",
  initial: { y: "100%" },
  idle: {
    value: { y: 0, scale: 1 },
    options: { duration: 0 }
  },
  // The sheet rising.
  enter: {
    value: { y: 0 },
    options: { duration: SHEET_IN, ease: SHEET_EASE }
  },
  // The sheet leaving, back down the way it came.
  enterBack: {
    value: { y: "100%" },
    options: { duration: SHEET_OUT, ease: SHEET_EASE }
  },
  // The list stepping back while the sheet covers it, and stepping forward
  // again as the sheet leaves.
  exit: {
    value: { scale: 0.94 },
    options: { duration: SHEET_IN, ease: SHEET_EASE }
  },
  exitBack: {
    value: { scale: 1 },
    options: { duration: SHEET_OUT, ease: SHEET_EASE }
  }
});

export default sheet;
