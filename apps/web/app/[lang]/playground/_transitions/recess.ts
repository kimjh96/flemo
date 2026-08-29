"use client";

import { createDecorator } from "@flemo/react";

import "./recess.types";

// A CONSUMER-AUTHORED decorator, and now a short one: it says what the dim
// LOOKS like and nothing about when it runs.
//
// It carried `drift`'s two durations until decorators started inheriting the
// clock of the transition that names them. Keeping them equal was the entire
// reason drift.constants.ts was extracted, and this file quoted the trap it
// was avoiding:
//
//   layout.ts, before the change
//     "A decorator is compiled once per NAME, not once per transition that
//      names it: one set of keyframes, with the durations its author wrote."
//
// Both halves of that are gone. `drift` names this dim, so this dim runs on
// `drift`'s clock, on both directions, and retuning either one cannot leave the
// two disagreeing.
//
// The dim is lighter than `overlay`'s, which is a look and therefore still
// authored here. `drift` already pushes the covered screen back in scale, so
// the dim is a second cue for the same depth rather than the only one, and at
// 0.1 it read as a grey cast over a screen that was visibly receding anyway.
const DIM = "rgba(0, 0, 0, 0.06)";

const recess = createDecorator({
  name: "recess",
  initial: { opacity: 0, backgroundColor: DIM },
  idle: { value: { opacity: 0, backgroundColor: DIM } },
  // The screen going behind: the dim arrives over the span that puts it there.
  enter: { value: { opacity: 1, backgroundColor: DIM } },
  // The screen coming back to the front, over the span of the pop that
  // uncovers it.
  exit: { value: { opacity: 0, backgroundColor: DIM } }
});

export default recess;
